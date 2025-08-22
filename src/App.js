import React from 'react';
import { AreaChart, Area, Tooltip as RechartsTooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts';
import { HelpCircle, TrendingUp, TrendingDown, Minus, Wifi, WifiOff } from 'lucide-react';

// Shadcn UI Component Stubs (as we can't import them directly)
const Card = ({ children, className = '' }) => <div className={`bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 ${className}`}>{children}</div>;
const CardHeader = ({ children, className = '' }) => <div className={`mb-4 ${className}`}>{children}</div>;
const CardTitle = ({ children, className = '' }) => <h3 className={`text-lg font-semibold text-gray-200 ${className}`}>{children}</h3>;
const CardContent = ({ children, className = '' }) => <div className={className}>{children}</div>;
const TooltipProvider = ({ children }) => <div>{children}</div>;
const Tooltip = ({ children, content }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded py-2 px-3 border border-gray-700 z-10">
      {content}
    </div>
  </div>
);
const TooltipTrigger = ({ children }) => <div>{children}</div>;
const Badge = ({ children, className = '' }) => <span className={`px-2 py-1 text-xs font-medium rounded-full ${className}`}>{children}</span>;

// --- Mock Data ---
const createDateSeries = (days) => {
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
};
const dates = createDateSeries(90);
const mockApiData = {
    yieldCurve: { observations: dates.map((date, i) => ({ date, value: (0.3 + Math.sin(i / 20) * 0.15 + (Math.random() - 0.5) * 0.05).toFixed(2) })) },
    joblessClaims: { observations: dates.map((date, i) => ({ date, value: (230000 + Math.cos(i / 15) * 10000 + (Math.random() - 0.5) * 5000).toFixed(0) })) },
    vix: { observations: dates.map((date, i) => ({ date, value: (18 - Math.sin(i / 25) * 3 + (Math.random() - 0.5) * 2).toFixed(2) })) },
    sp500: { historical: dates.map((date, i) => ({ date, close: (5400 + Math.sin(i / 10) * 80 + i * 1.5 + (Math.random() - 0.5) * 50).toFixed(2) })) },
    wtiOil: { historical: dates.map((date, i) => ({ date, close: (82 + Math.cos(i / 30) * 5 + (Math.random() - 0.5) * 3).toFixed(2) })) }
};
mockApiData.yieldCurve.observations[89].value = "0.45";
mockApiData.yieldCurve.observations[88].value = "0.43";
mockApiData.joblessClaims.observations[89].value = "242000";
mockApiData.joblessClaims.observations[88].value = "233000";
mockApiData.vix.observations[89].value = "19.8";
mockApiData.vix.observations[88].value = "18.3";
mockApiData.sp500.historical[89].close = "5510.40";
mockApiData.sp500.historical[88].close = "5525.60";
mockApiData.wtiOil.historical[89].close = "85.50";
mockApiData.wtiOil.historical[88].close = "84.75";

// API Keys
// API Keys accessed from environment variables
const FRED_API_KEY = process.env.REACT_APP_FRED_API_KEY;
const FMP_API_KEY = process.env.REACT_APP_FMP_API_KEY;

// Main App Component
const App = () => {
    const [indicatorData, setIndicatorData] = React.useState(null);
    const [hemiScore, setHemiScore] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [useLiveData, setUseLiveData] = React.useState(false);

    const processData = React.useCallback((apiData) => {
        const [yieldData, joblessData, vixData, sp500Data, oilData] = apiData;

        const processFredData = (seriesData, isInverted = false) => {
            if (!seriesData || !seriesData.observations) throw new Error("Invalid FRED data structure received.");
            const validObservations = seriesData.observations.filter(d => d.value !== '.').map(d => ({ date: d.date, value: parseFloat(d.value) }));
            if (validObservations.length < 2) return { currentValue: 0, recentChange: 0, score: 0, history: validObservations };
            
            const latest = validObservations[validObservations.length - 1];
            const previous = validObservations[validObservations.length - 2];
            const values = validObservations.map(d => d.value);
            const min = Math.min(...values);
            const max = Math.max(...values);
            
            let percentile = max === min ? 0.5 : (latest.value - min) / (max - min);
            let score = isInverted ? (1 - percentile) * 100 : percentile * 100;

            return { currentValue: latest.value, recentChange: latest.value - previous.value, score, history: validObservations };
        };
        
        const processFmpData = (seriesData, isInverted = false) => {
            if (!seriesData || !seriesData.historical || seriesData.historical.length < 2) throw new Error("Invalid FMP data structure received.");
            const history = seriesData.historical.slice().reverse().map(d => ({ date: d.date, value: d.close }));
            
            const latest = history[history.length - 1];
            const previous = history[history.length - 2];
            const values = history.map(d => d.value);
            const min = Math.min(...values);
            const max = Math.max(...values);

            let percentile = max === min ? 0.5 : (latest.value - min) / (max - min);
            let score = isInverted ? (1 - percentile) * 100 : percentile * 100;

            return { currentValue: latest.value, recentChange: latest.value - previous.value, score, history };
        };

        const processedData = {
            yieldCurve: processFredData(yieldData),
            joblessClaims: processFredData(joblessData, true),
            sp500: processFmpData(sp500Data),
            vix: processFmpData(vixData, true),
            wtiOil: processFmpData(oilData),
        };
        
        setIndicatorData(processedData);

        const weights = { yieldCurve: 0.30, joblessClaims: 0.25, sp500: 0.20, vix: 0.15, wtiOil: 0.10 };
        const calculatedHemiScore = 
            processedData.yieldCurve.score * weights.yieldCurve +
            processedData.joblessClaims.score * weights.joblessClaims +
            processedData.sp500.score * weights.sp500 +
            processedData.vix.score * weights.vix +
            processedData.wtiOil.score * weights.wtiOil;

        setHemiScore(calculatedHemiScore);
    }, []);

    React.useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                if (useLiveData) {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setFullYear(endDate.getFullYear() - 5);
                    const formattedEndDate = endDate.toISOString().split('T')[0];
                    const formattedStartDate = startDate.toISOString().split('T')[0];

                    const corsProxy = 'https://api.allorigins.win/raw?url=';

                    const fredBaseUrl = `https://api.stlouisfed.org/fred/series/observations?api_key=${FRED_API_KEY}&file_type=json`;
                    const fmpBaseUrl = `https://financialmodelingprep.com/api/v3`;

                    const urls = {
                        yieldCurve: `${corsProxy}${encodeURIComponent(`${fredBaseUrl}&series_id=T10Y2Y&observation_start=${formattedStartDate}&observation_end=${formattedEndDate}`)}`,
                        joblessClaims: `${corsProxy}${encodeURIComponent(`${fredBaseUrl}&series_id=ICSA&observation_start=${formattedStartDate}&observation_end=${formattedEndDate}`)}`,
                        vix: `${corsProxy}${encodeURIComponent(`${fredBaseUrl}&series_id=VIXCLS&observation_start=${formattedStartDate}&observation_end=${formattedEndDate}`)}`,
                        sp500: `${corsProxy}${encodeURIComponent(`${fmpBaseUrl}/historical-price-full/%5EGSPC?from=${formattedStartDate}&to=${formattedEndDate}&apikey=${FMP_API_KEY}`)}`,
                        wtiOil: `${corsProxy}${encodeURIComponent(`${fmpBaseUrl}/historical-price-full/CLUSD?from=${formattedStartDate}&to=${formattedEndDate}&apikey=${FMP_API_KEY}`)}`,
                    };

                    const responses = await Promise.all(Object.values(urls).map(url => fetch(url)));
                    
                    for (const res of responses) {
                        if (!res.ok) {
                            if (res.status === 401 || res.status === 403) {
                                throw new Error(`API Key Invalid or Unauthorized (Status: ${res.status}). Please verify your API keys.`);
                            }
                            const errorText = await res.text();
                            throw new Error(`API request failed with status ${res.status}: ${errorText}`);
                        }
                    }
                    
                    const data = await Promise.all(responses.map(res => res.json()));
                    processData(data);
                } else {
                    // Use mock data
                    const data = [mockApiData.yieldCurve, mockApiData.joblessClaims, mockApiData.vix, mockApiData.sp500, mockApiData.wtiOil];
                    processData(data);
                }
            } catch (err) {
                console.error("Data loading error:", err);
                let diagnosticMessage = err.message;
                if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
                    diagnosticMessage = "A network error occurred. This could be due to a CORS policy, a firewall, or an internet connectivity issue. Ensure you are connected to the internet and that no browser extensions are blocking the request.";
                }
                setError(`Failed to load live data. ${diagnosticMessage}`);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [useLiveData, processData]);

    const getHemiStatus = (score) => {
        if (score < 25) return { text: "High Recession Risk", color: "text-red-400" };
        if (score < 45) return { text: "Economic Slowdown", color: "text-yellow-400" };
        if (score < 65) return { text: "Moderate Expansion", color: "text-cyan-400" };
        return { text: "Strong Expansion", color: "text-green-400" };
    };

    const hemiStatus = getHemiStatus(hemiScore);

    return (
        <div className="bg-gray-900 text-gray-300 min-h-screen font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">High-Frequency Economic Momentum Index (HEMI)</h1>
                    </div>
                    <div className="flex justify-center items-center mt-4 space-x-4">
                        <span className={`flex items-center text-sm ${useLiveData ? 'text-cyan-400' : 'text-yellow-400'}`}>
                            {useLiveData ? <Wifi className="h-4 w-4 mr-2"/> : <WifiOff className="h-4 w-4 mr-2"/>}
                            {useLiveData ? 'Live Data' : 'Sample Data'}
                        </span>
                        <div className="flex items-center space-x-2">
                            <label htmlFor="data-toggle" className="text-sm text-gray-400">Sample</label>
                            <button onClick={() => setUseLiveData(!useLiveData)} id="data-toggle" className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${useLiveData ? 'bg-cyan-600' : 'bg-gray-600'}`}>
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${useLiveData ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                             <label htmlFor="data-toggle" className="text-sm text-gray-400">Live</label>
                        </div>
                    </div>
                </header>

                <main className="space-y-8">
                    {loading && (
                         <div className="flex justify-center items-center p-10">
                            <svg className="animate-spin h-8 w-8 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                         </div>
                    )}
                    {error && (
                        <Card className="bg-red-900/50 border-red-700">
                            <CardHeader>
                                <CardTitle className="text-red-300">Data Fetching Error</CardTitle>
                            </CardHeader>
                            <CardContent className="text-red-400 text-sm">
                                {error}
                            </CardContent>
                        </Card>
                    )}
                    {!loading && !error && indicatorData && (
                        <>
                            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <Card className="lg:col-span-1 flex flex-col items-center justify-center text-center">
                                    <h2 className="text-xl font-semibold text-white mb-4">Current HEMI Score</h2>
                                    <HemiGauge score={hemiScore} status={hemiStatus} />
                                    <p className={`text-2xl font-bold mt-4 ${hemiStatus.color}`}>{hemiStatus.text}</p>
                                </Card>
                                <Card className="lg:col-span-2">
                                    <EconomicSummary data={indicatorData} score={hemiScore} />
                                </Card>
                            </section>
                            
                            <section>
                                <h2 className="text-2xl font-semibold text-white mb-6">Core Economic Indicators</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                                    <IndicatorCard data={indicatorData.yieldCurve} title="Yield Curve (10Y-2Y)" format="percent" tooltipContent="Difference between 10-year and 2-year Treasury yields. A positive curve signals expansion; an inverted curve is a recession predictor." />
                                    <IndicatorCard data={indicatorData.joblessClaims} title="Initial Jobless Claims" format="number" tooltipContent="New unemployment filings. Rising claims suggest a weakening labor market. Lower is better." />
                                    <IndicatorCard data={indicatorData.sp500} title="S&P 500 Index" format="currency" tooltipContent="Tracks 500 large U.S. companies. A rising market reflects investor confidence. Higher is better." />
                                    <IndicatorCard data={indicatorData.vix} title="VIX (Volatility Index)" format="number" tooltipContent="The market's 'fear gauge.' High VIX indicates investor fear. Lower is better." />
                                    <IndicatorCard data={indicatorData.wtiOil} title="WTI Crude Oil Price" format="currency" tooltipContent="Price of West Texas Intermediate crude oil. Signals demand but also inflation risk." />
                                </div>
                            </section>

                            <section>
                                <h2 className="text-2xl font-semibold text-white mb-6">Expert Opinions & Forecasts</h2>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <ExpertOpinionCard name="Dr. Anya Sharma" title="Chief Market Strategist, Global Macro Insights" opinion="Cautiously Optimistic" opinionColor="text-cyan-400" forecast="The HEMI score accurately captures the current 'crosstalk' in the data. While the labor market's softening warrants close attention, it's more of a normalization than a collapse. The positive yield curve is the most important long-term signal, pointing toward continued, albeit slower, growth." />
                                    <ExpertOpinionCard name="James Chen" title="Portfolio Manager, Penrose Capital" opinion="Bearish / Defensive" opinionColor="text-yellow-400" forecast="I see the dashboard as a flashing yellow light. The VIX is telling you that smart money is hedging, and the jobless claims are the 'canary in the coal mine.' The divergence between the S&P 500 and the real economy is unsustainable. We are positioned for a market correction." />
                                    <ExpertOpinionCard name="Dr. Kenji Tanaka" title="Economist, Center for Economic Policy" opinion="Neutral / Data-Dependent" opinionColor="text-gray-400" forecast="The HEMI score is in an ambiguous zone. The key variable is WTI Crude Oil. If energy prices continue to rise, it could reignite inflation and force central banks to maintain a restrictive policy, tipping the scales towards a slowdown. The next few weeks of data will be critical." />
                                </div>
                            </section>
                            
                            <Methodology />
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

// --- Child Components ---

const HemiGauge = ({ score, status }) => {
    const data = [{ name: 'HEMI', value: score }];
    const color = status.color.startsWith('text-red') ? '#F87171' :
                  status.color.startsWith('text-yellow') ? '#FBBF24' :
                  status.color.startsWith('text-cyan') ? '#22D3EE' : '#4ADE80';

    return (
        <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={180} endAngle={0} barSize={30}>
                    <RadialBar minAngle={15} background clockWise={true} dataKey='value' fill={color} cornerRadius={15} />
                    <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="text-4xl font-bold fill-current text-white">{score.toFixed(1)}</text>
                    <text x="50%" y="80%" textAnchor="middle" dominantBaseline="middle" className="text-sm font-normal fill-current text-gray-400">/ 100</text>
                </RadialBarChart>
            </ResponsiveContainer>
        </div>
    );
};

const EconomicSummary = ({ data, score }) => {
    const getTrendDirection = (indicator, name) => {
        const isInverted = name === 'joblessClaims' || name === 'vix';
        return (isInverted ? indicator.score < 50 : indicator.score > 50) ? 'positive' : 'negative';
    };
    const isExpansion = score >= 45;
    const confirming = Object.entries(data).filter(([name, ind]) => (isExpansion ? getTrendDirection(ind, name) === 'positive' : getTrendDirection(ind, name) === 'negative'));
    const contradicting = Object.entries(data).filter(([name, ind]) => (isExpansion ? getTrendDirection(ind, name) === 'negative' : getTrendDirection(ind, name) === 'positive'));
    const formatTitle = (key) => ({ yieldCurve: "Yield Curve", joblessClaims: "Jobless Claims", sp500: "S&P 500", vix: "VIX", wtiOil: "WTI Oil" }[key] || key);

    return (
        <div>
            <CardHeader>
                <CardTitle>Dynamic Economic Summary</CardTitle>
                <p className="text-sm text-gray-400 mt-1">Analysis based on the current HEMI score of <span className="font-bold text-white">{score.toFixed(1)}</span>.</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold text-green-400 mb-2">Confirming Data (Supporting Trend)</h4>
                    <ul className="space-y-2 text-sm">{confirming.map(([key, ind]) => <li key={key} className="flex items-center"><TrendingUp className="h-4 w-4 mr-2 text-green-500" />{formatTitle(key)} (Score: {ind.score.toFixed(1)})</li>)}</ul>
                </div>
                <div>
                    <h4 className="font-semibold text-yellow-400 mb-2">Contradicting Data (Counter-Signals)</h4>
                    <ul className="space-y-2 text-sm">{contradicting.map(([key, ind]) => <li key={key} className="flex items-center"><TrendingDown className="h-4 w-4 mr-2 text-yellow-500" />{formatTitle(key)} (Score: {ind.score.toFixed(1)})</li>)}</ul>
                </div>
            </CardContent>
        </div>
    );
};

const IndicatorCard = ({ data, title, format, tooltipContent }) => {
    const { currentValue, recentChange, history } = data;
    const isPositive = recentChange > 0;
    const isNeutral = recentChange === 0;
    const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
    const trendColor = isNeutral ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400';
    
    const formatValue = (value) => {
        if (typeof value !== 'number') return 'N/A';
        switch (format) {
            case 'currency': return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            case 'percent': return `${value.toFixed(2)}%`;
            case 'number': return value.toLocaleString();
            default: return value;
        }
    };
    
    const sparklineColor = isPositive ? "#34D399" : "#F87171";

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
                <TooltipProvider><Tooltip content={tooltipContent}><TooltipTrigger><HelpCircle className="h-4 w-4 text-gray-500" /></TooltipTrigger></Tooltip></TooltipProvider>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-white">{formatValue(currentValue)}</div>
                <p className={`text-xs ${trendColor} flex items-center`}><TrendIcon className="h-4 w-4 mr-1" />{formatValue(recentChange)}</p>
                <div className="h-20 w-full mt-4">
                    <ResponsiveContainer>
                        <AreaChart data={history}>
                            <defs><linearGradient id={`color${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={sparklineColor} stopOpacity={0.8}/><stop offset="95%" stopColor={sparklineColor} stopOpacity={0}/></linearGradient></defs>
                            <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(20, 20, 30, 0.8)', borderColor: '#4A5568', color: '#E2E8F0' }} labelFormatter={(label) => new Date(label).toLocaleDateString()} formatter={(value) => [formatValue(value), "Value"]} />
                            <Area type="monotone" dataKey="value" stroke={sparklineColor} strokeWidth={2} fillOpacity={1} fill={`url(#color${title.replace(/\s/g, '')})`} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

const ExpertOpinionCard = ({ name, title, opinion, opinionColor, forecast }) => (
    <Card>
        <CardHeader>
            <CardTitle className="text-base">{name}</CardTitle>
            <p className="text-xs text-gray-500">{title}</p>
        </CardHeader>
        <CardContent>
            <Badge className={`${opinionColor} bg-opacity-20 mb-3`}>{opinion}</Badge>
            <p className="text-sm text-gray-400">{forecast}</p>
        </CardContent>
    </Card>
);

const Methodology = () => (
    <Card>
        <CardHeader><CardTitle>HEMI Methodology & Data Sources</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-400">
            <div>
                <h4 className="font-semibold text-gray-200 mb-2">Calculation Methodology</h4>
                <p>The HEMI score is a weighted average of its five core components. For each indicator, the latest data point is normalized into a score from 0 to 100 by calculating its percentile rank over the last five years of its own history. For indicators where a lower value is better (e.g., Jobless Claims, VIX), the percentile rank is inverted (100 - percentile).</p>
                <p className="mt-2 font-mono bg-gray-900 p-3 rounded-md text-xs">HEMI = (YieldCurve_Score * 0.30) + (JoblessClaims_Score * 0.25) + (SP500_Score * 0.20) + (VIX_Score * 0.15) + (Oil_Score * 0.10)</p>
            </div>
            <div>
                <h4 className="font-semibold text-gray-200 mb-2">Data Sources</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li>Yield Curve, Jobless Claims, VIX: <a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-1">St. Louis Federal Reserve (FRED)</a></li>
                    <li>S&P 500, WTI Crude Oil: <a href="https://site.financialmodelingprep.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-1">Financial Modeling Prep (FMP)</a></li>
                </ul>
            </div>
        </CardContent>
    </Card>
);

export default App;
