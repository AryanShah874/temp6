import axios from 'axios';

const API_URL = 'http://localhost:8080/api';

export const sendTransactionApi = async (transaction: any, userId: string) => {
  try {
    const response = await axios.post(`${API_URL}/transaction`, {
      ...transaction,
      userId
    });
    return response.data;
  } catch (error) {
    console.error('Transaction API error:', error);
    throw error;
  }
};