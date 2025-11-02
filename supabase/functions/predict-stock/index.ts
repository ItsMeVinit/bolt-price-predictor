import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Prediction {
  date: string;
  predicted_price: number;
  confidence_lower: number;
  confidence_upper: number;
}

// Simple linear regression prediction with moving average
function predictPrices(historicalPrices: number[], daysToPredict: number): Prediction[] {
  const predictions: Prediction[] = [];
  const n = historicalPrices.length;
  
  if (n < 10) {
    throw new Error('Insufficient historical data for prediction');
  }
  
  // Calculate moving average trend
  const windowSize = Math.min(30, Math.floor(n / 3));
  const recentPrices = historicalPrices.slice(-windowSize);
  
  // Simple linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < recentPrices.length; i++) {
    sumX += i;
    sumY += recentPrices[i];
    sumXY += i * recentPrices[i];
    sumX2 += i * i;
  }
  
  const slope = (recentPrices.length * sumXY - sumX * sumY) / 
                (recentPrices.length * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / recentPrices.length;
  
  // Calculate volatility for confidence intervals
  const mean = sumY / recentPrices.length;
  const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - mean, 2), 0) / recentPrices.length;
  const stdDev = Math.sqrt(variance);
  
  const lastPrice = historicalPrices[n - 1];
  const today = new Date();
  
  for (let i = 1; i <= daysToPredict; i++) {
    const predictedPrice = slope * (recentPrices.length + i) + intercept;
    
    // Ensure predicted price doesn't deviate too much from last known price
    const maxChange = lastPrice * 0.15; // Max 15% change per prediction window
    const clampedPrice = Math.max(
      lastPrice - maxChange,
      Math.min(lastPrice + maxChange, predictedPrice)
    );
    
    // Confidence intervals widen with prediction distance
    const confidenceMultiplier = 1 + (i / daysToPredict) * 0.5;
    const confidenceRange = stdDev * confidenceMultiplier * 1.96; // 95% confidence
    
    const predictionDate = new Date(today);
    predictionDate.setDate(today.getDate() + i);
    
    predictions.push({
      date: predictionDate.toISOString().split('T')[0],
      predicted_price: Math.max(0, clampedPrice),
      confidence_lower: Math.max(0, clampedPrice - confidenceRange),
      confidence_upper: clampedPrice + confidenceRange,
    });
  }
  
  return predictions;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get('ticker')?.toUpperCase();
    const days = parseInt(url.searchParams.get('days') || '30');

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: 'Ticker symbol is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (days < 1 || days > 90) {
      return new Response(
        JSON.stringify({ error: 'Days must be between 1 and 90' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get historical data from database
    const { data: historicalData, error: dbError } = await supabase
      .from('stock_data')
      .select('close, date')
      .eq('ticker', ticker)
      .order('date', { ascending: true })
      .limit(365);

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch historical data' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!historicalData || historicalData.length < 10) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient historical data. Please fetch stock data first.' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract closing prices
    const closingPrices = historicalData.map((d: any) => parseFloat(d.close));
    
    // Generate predictions
    const predictions = predictPrices(closingPrices, days);
    
    // Store predictions in database
    const predictionDate = new Date().toISOString().split('T')[0];
    const recordsToInsert = predictions.map(pred => ({
      ticker,
      prediction_date: predictionDate,
      target_date: pred.date,
      predicted_price: pred.predicted_price,
      confidence_lower: pred.confidence_lower,
      confidence_upper: pred.confidence_upper,
      model_version: 'linear_regression_v1',
    }));

    await supabase
      .from('predictions')
      .insert(recordsToInsert);

    return new Response(
      JSON.stringify({
        ticker,
        prediction_days: days,
        predictions,
        model: 'linear_regression_v1',
        disclaimer: 'These predictions are for educational purposes only and should not be used for actual trading decisions.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});