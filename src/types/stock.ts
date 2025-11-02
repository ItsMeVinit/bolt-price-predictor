export interface StockDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Prediction {
  date: string;
  predicted_price: number;
  confidence_lower: number;
  confidence_upper: number;
}

export interface StockDataResponse {
  ticker: string;
  current_price: number;
  historical_data: StockDataPoint[];
  source: 'cache' | 'live';
}

export interface PredictionResponse {
  ticker: string;
  prediction_days: number;
  predictions: Prediction[];
  model: string;
  disclaimer: string;
}
