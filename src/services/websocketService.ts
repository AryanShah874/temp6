import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, Transaction, PricePoint } from '../types';
import { 
  setWebSocketConnected, 
  setUserInfo, 
  updateUserWallet, 
  addTransaction, 
  addLiveTransaction, 
  updateStockPrice, 
  addPricePoint,
  setPriceHistory
} from '../store/stockSlice';
import { store } from '../store';

let socket: Socket | null = null;
let currentStockRoom: string | null = null;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 3;

// Mock data for when Socket.IO is not available
let mockUserData = {
  userId: 'mock-user-id',
  userName: 'MockUser',
  wallet: {
    balance: 25000,
    holdings: {}
  }
};

// Initialize Socket.IO connection
export const initializeWebSocket = (): Promise<void> => {
  return new Promise((resolve) => {
    if (socket && socket.connected) {
      resolve();
      return;
    }

    // Close existing socket if it exists
    if (socket) {
      socket.disconnect();
    }

    // In development environment, we might not have the Socket.IO server running
    // So we'll use mock data if we can't connect after a few attempts
    if (connectionAttempts >= MAX_ATTEMPTS) {
      console.log('Using mock data for Socket.IO');
      store.dispatch(setUserInfo(mockUserData));
      store.dispatch(setWebSocketConnected(true));
      resolve();
      return;
    }

    connectionAttempts++;

    try {
      // Create new Socket.IO connection
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const wsUrl = `${protocol}//${window.location.hostname}:8080`;
      
      socket = io(wsUrl, {
        reconnectionAttempts: 3,
        timeout: 10000
      });

      socket.on('connect', () => {
        console.log('Socket.IO connection established');
        connectionAttempts = 0;
        store.dispatch(setWebSocketConnected(true));
        resolve();
      });

      socket.on('disconnect', () => {
        console.log('Socket.IO connection closed');
        store.dispatch(setWebSocketConnected(false));
      });

      socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        if (connectionAttempts >= MAX_ATTEMPTS) {
          useMockData();
          resolve();
        }
      });

      // Handle Socket.IO messages
      socket.on('USER_INFO', (data) => {
        store.dispatch(setUserInfo({
          userId: data.userId,
          userName: data.userName,
          wallet: data.wallet
        }));
      });

      socket.on('STOCK_PRICE', (data) => {
        store.dispatch(setPriceHistory(data.history || []));
      });

      socket.on('STOCK_PRICE_UPDATE', (data) => {
        store.dispatch(updateStockPrice({
          stockName: data.stockName,
          previousPrice: data.previousPrice,
          currentPrice: data.currentPrice,
          change: data.change,
          percentChange: data.percentChange,
          timestamp: data.timestamp
        }));
        
        store.dispatch(addPricePoint({
          price: data.currentPrice,
          timestamp: data.timestamp
        }));
      });

      socket.on('TRANSACTION_RESULT', (data) => {
        // Update user wallet
        store.dispatch(updateUserWallet(data.wallet));
        
        // Add transaction to history (both successful and failed)
        store.dispatch(addTransaction(data.transaction));
      });

      socket.on('LIVE_TRANSACTION', (data) => {
        const { transaction } = data;
        store.dispatch(addLiveTransaction(transaction));
      });

    } catch (error) {
      console.error('Error creating Socket.IO:', error);
      if (connectionAttempts >= MAX_ATTEMPTS) {
        useMockData();
      }
      resolve();
    }
  });
};

// Use mock data when Socket.IO is not available
const useMockData = () => {
  console.log('Using mock data for Socket.IO');
  store.dispatch(setUserInfo(mockUserData));
  store.dispatch(setWebSocketConnected(true));
};

// Join a stock room
export const joinStockRoom = (stockName: string) => {
  if (!socket || !socket.connected) {
    console.log('Socket.IO not connected, using mock data');
    
    // If Socket.IO is not connected, use mock data
    const mockPrice = 500 + Math.floor(Math.random() * 200);
    const mockPriceHistory: PricePoint[] = [];
    
    // Generate mock price history
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - (10 - i) * 5000).toISOString();
      mockPriceHistory.push({
        price: mockPrice - 100 + Math.floor(Math.random() * 200),
        timestamp
      });
    }
    
    // Add current price
    mockPriceHistory.push({
      price: mockPrice,
      timestamp: now.toISOString()
    });
    
    // Update store with mock data
    store.dispatch(setPriceHistory(mockPriceHistory));
    store.dispatch(updateStockPrice({
      stockName,
      previousPrice: mockPriceHistory[mockPriceHistory.length - 2].price,
      currentPrice: mockPrice,
      change: mockPrice - mockPriceHistory[mockPriceHistory.length - 2].price,
      percentChange: ((mockPrice - mockPriceHistory[mockPriceHistory.length - 2].price) / mockPriceHistory[mockPriceHistory.length - 2].price) * 100,
      timestamp: now.toISOString()
    }));
    
    // Start mock price updates
    startMockPriceUpdates(stockName);
    
    return;
  }

  // Leave current room if any
  if (currentStockRoom) {
    leaveStockRoom();
  }

  // Join new room
  socket.emit('JOIN_STOCK_ROOM', stockName);
  currentStockRoom = stockName;
};

// Mock price updates for when Socket.IO is not available
let mockPriceInterval: NodeJS.Timeout | null = null;

function startMockPriceUpdates(stockName: string) {
  if (mockPriceInterval) {
    clearInterval(mockPriceInterval);
  }
  
  mockPriceInterval = setInterval(() => {
    const { currentPrice } = store.getState().stocks;
    const priceChange = Math.floor(Math.random() * 1001) - 500;
    const newPrice = Math.max(1, currentPrice + priceChange);
    const percentChange = ((newPrice - currentPrice) / currentPrice) * 100;
    
    store.dispatch(updateStockPrice({
      stockName,
      previousPrice: currentPrice,
      currentPrice: newPrice,
      change: priceChange,
      percentChange,
      timestamp: new Date().toISOString()
    }));
    
    store.dispatch(addPricePoint({
      price: newPrice,
      timestamp: new Date().toISOString()
    }));
  }, 5000);
}

function stopMockPriceUpdates() {
  if (mockPriceInterval) {
    clearInterval(mockPriceInterval);
    mockPriceInterval = null;
  }
}

// Leave current stock room
export const leaveStockRoom = () => {
  // Stop mock price updates if they're running
  stopMockPriceUpdates();
  
  if (!socket || !socket.connected || !currentStockRoom) {
    return;
  }

  socket.emit('LEAVE_STOCK_ROOM', currentStockRoom);
  currentStockRoom = null;
};

// Send a transaction
export const sendTransaction = (transaction: Partial<Transaction>) => {
  if (!socket || !socket.connected) {
    console.log('Socket.IO not connected, simulating transaction');
    
    // Simulate transaction with mock data
    const mockTransaction: Transaction = {
      stock_name: transaction.stock_name || '',
      stock_symbol: transaction.stock_symbol || '',
      transaction_price: transaction.transaction_price || 0,
      quantity: transaction.quantity || 0,
      action: transaction.action || 'buy',
      timestamp: new Date().toISOString(),
      status: 'Passed',
      user: mockUserData.userName
    };
    
    // Update wallet
    const totalCost = mockTransaction.transaction_price * (mockTransaction.quantity || 0);
    let newBalance = mockTransaction.action === 'buy' 
      ? mockUserData.wallet.balance - totalCost
      : mockUserData.wallet.balance + totalCost;
    
    // Check if transaction should succeed
    if (mockTransaction.action === 'buy' && newBalance < 0) {
      mockTransaction.status = 'Failed';
    } else if (mockTransaction.action === 'sell') {
      const currentHolding = mockUserData.wallet.holdings[mockTransaction.stock_name] || 0;
      if (currentHolding < (mockTransaction.quantity || 0)) {
        mockTransaction.status = 'Failed';
      }
    }
    
    // Update mock wallet if transaction succeeded
    if (mockTransaction.status === 'Passed') {
      mockUserData.wallet.balance = newBalance;
      
      if (mockTransaction.action === 'buy') {
        if (!mockUserData.wallet.holdings[mockTransaction.stock_name]) {
          mockUserData.wallet.holdings[mockTransaction.stock_name] = 0;
        }
        mockUserData.wallet.holdings[mockTransaction.stock_name] += (mockTransaction.quantity || 0);
      } else {
        mockUserData.wallet.holdings[mockTransaction.stock_name] -= (mockTransaction.quantity || 0);
      }
      
      // Dispatch actions
      store.dispatch(updateUserWallet(mockUserData.wallet));
      store.dispatch(addTransaction(mockTransaction));
      store.dispatch(addLiveTransaction(mockTransaction));
    } else {
      // Even if transaction failed, add it to the transaction history
      store.dispatch(addTransaction(mockTransaction));
    }
    
    return;
  }

  socket.emit('TRANSACTION', transaction);
};

// Close Socket.IO connection
export const closeWebSocket = () => {
  stopMockPriceUpdates();
  
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};