import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

export async function gradePortfolio({ portfolioId, filePath, rubricText }) {
  const resp = await axios.post(`${ML_URL}/grade`, {
    portfolio_id: portfolioId,
    file_path: filePath,
    rubric: rubricText || null
  }, { timeout: 120000 });
  return resp.data;
}
