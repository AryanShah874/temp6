import { Transaction } from '../types';
import { store } from '../store';

// Mock transactions data
const mockTransactions: Transaction[] = [
  {
    stock_name: "Zomato",
    stock_symbol: "ZOM",
    transaction_price: 142.32,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    status: "Passed",
    quantity: 100,
    action: "buy"
  },
  {
    stock_name: "Reliance",
    stock_symbol: "REL",
    transaction_price: 2500.75,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    status: "Passed",
    quantity: 50,
    action: "buy"
  },
  {
    stock_name: "TCS",
    stock_symbol: "TCS",
    transaction_price: 3450.20,
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    status: "Failed",
    quantity: 200,
    action: "buy"
  }
];

export const fetchTransactions = async (): Promise<Transaction[]> => {
  try {
    const response = await fetch('https://stockmarket-data-kdu.s3.ap-south-1.amazonaws.com/portfolio-transactions.json');
    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }
    
    const data = await response.json();
    
    // Map the API response to match our expected format
    // Ensure status is 'Passed' or 'Failed' (capitalize first letter)
    const apiTransactions = data.map((item: any) => ({
      ...item,
      status: item.status === 'success' ? 'Passed' : 
              item.status === 'failed' ? 'Failed' : item.status
    }));
    
    // Get user transactions from the store
    const { allTransactions } = store.getState().stocks;
    
    // Combine API transactions with user transactions
    const combinedTransactions = [...apiTransactions, ...allTransactions];
    
    // Remove duplicates (if any) based on timestamp and stock_name
    const uniqueTransactions = combinedTransactions.filter((transaction, index, self) => 
      index === self.findIndex(t => 
        t.timestamp === transaction.timestamp && 
        t.stock_name === transaction.stock_name &&
        t.transaction_price === transaction.transaction_price
      )
    );
    
    // Sort by timestamp in descending order
    uniqueTransactions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return uniqueTransactions;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    // Return mock data if API fails
    return mockTransactions;
  }
};

export const addTransaction = (transaction: Transaction): Promise<Transaction> => {
  // This is a mock implementation since we don't have a real backend
  // In a real application, this would make a POST request to the backend
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(transaction);
    }, 500);
  });
};