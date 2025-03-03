const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const cors=require('cors')
const app = express();
app.use(express.json());

app.use(cors({origin: 'http://localhost:5173', credentials: true, methods: 'GET, POST, PUT, PATCH, DELETE'})); 


// Create HTTP server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active connections by stock room
const stockRooms = {};
// Store user names
const userNames = {};
// Store user balances and holdings
const userWallets = {};
// Store stock prices
const stockPrices = {};

// Generate a random name for users
const generateRandomName = () => {
  const names = [
    'Sayan', 'Aakash', 'Amey', 'Rahul', 'Priya', 
    'Neha', 'Vikram', 'Anjali', 'Rohan', 'Kavita',
    'Arjun', 'Divya', 'Karan', 'Meera', 'Rajiv'
  ];
  return names[Math.floor(Math.random() * names.length)];
};

// Generate a random wallet balance between 10000 and 50000
const generateRandomBalance = () => {
  return Math.floor(Math.random() * 40000) + 10000;
};

// Handle Socket.IO connections
io.on('connection', (socket) => {
  const userId = uuidv4();
  
  // Get userName from query parameters or generate a random one
  const userNameFromClient = socket.handshake.query.userName;
  const userName = userNameFromClient || generateRandomName();
  
  // Initialize user data
  userNames[userId] = userName;
  userWallets[userId] = {
    balance: generateRandomBalance(),
    holdings: {}
  };
  
  console.log(`User ${userName} (${userId}) connected`);
  
  // Send initial user data to client
  socket.emit('USER_INFO', {
    userId,
    userName,
    wallet: userWallets[userId]
  });
  
  // Handle joining a stock room
  socket.on('JOIN_STOCK_ROOM', (stockName) => {
    // Leave current rooms first
    Object.keys(stockRooms).forEach(room => {
      if (stockRooms[room] && stockRooms[room][userId]) {
        socket.leave(room);
        delete stockRooms[room][userId];
        
        // Broadcast leave notification to all users in the room
        socket.to(room).emit('NOTIFICATION', {
          message: `${userNames[userId]} left the room`,
          timestamp: new Date().toISOString()
        });
        
        // // If room is empty, stop price fluctuation
        // if (Object.keys(stockRooms[room]).length === 0) {
        //   stopPriceFluctuation(room);
        // }
      }
    });
    
    // Initialize stock room if it doesn't exist
    if (!stockRooms[stockName]) {
      stockRooms[stockName] = {};
      // Initialize stock price if it doesn't exist
      if (!stockPrices[stockName]) {
        // Get base price from somewhere or use a default
        stockPrices[stockName] = {
          basePrice: 500, // Default base price
          currentPrice: 500,
          history: []
        };
      }
      
      // Start price fluctuation for this stock
      startPriceFluctuation(stockName);
    }
    
    // Add user to stock room
    socket.join(stockName);
    stockRooms[stockName][userId] = socket.id;
    
    console.log(`User ${userNames[userId]} joined room: ${stockName}`);
    
    // Send current stock price to the user
    socket.emit('STOCK_PRICE', {
      stockName,
      price: stockPrices[stockName].currentPrice,
      history: stockPrices[stockName].history
    });
    
    // Broadcast join notification to all users in the room
    socket.to(stockName).emit('NOTIFICATION', {
      message: `${userNames[userId]} joined the room`,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle leaving a stock room
  socket.on('LEAVE_STOCK_ROOM', (stockName) => {
    if (stockRooms[stockName] && stockRooms[stockName][userId]) {
      socket.leave(stockName);
      delete stockRooms[stockName][userId];
      
      console.log(`User ${userNames[userId]} left room: ${stockName}`);
      
      // Broadcast leave notification to all users in the room
      socket.to(stockName).emit('NOTIFICATION', {
        message: `${userNames[userId]} left the room`,
        timestamp: new Date().toISOString()
      });
      
      // // If room is empty, stop price fluctuation
      // if (Object.keys(stockRooms[stockName]).length === 0) {
      //   stopPriceFluctuation(stockName);
      // }
    }
  });
  
  // Handle transaction
  socket.on('TRANSACTION', (transaction) => {
    const { stock_name, stock_symbol, transaction_price, quantity, action } = transaction;
    const userName = userNames[userId];
    const wallet = userWallets[userId];
    
    let status = 'Failed';
    let failureReason = '';
    
    // Process transaction based on action (buy/sell)
    if (action === 'buy') {
      const totalCost = transaction_price * quantity;
      
      // Check if user has enough balance
      if (wallet.balance >= totalCost) {
        // Update wallet balance
        wallet.balance -= totalCost;
        
        // Update holdings
        if (!wallet.holdings[stock_name]) {
          wallet.holdings[stock_name] = 0;
        }
        wallet.holdings[stock_name] += quantity;
        
        status = 'Passed';
      } else {
        failureReason = 'Insufficient balance';
      }
    } else if (action === 'sell') {
      // Check if user has enough stocks to sell
      if (wallet.holdings[stock_name] && wallet.holdings[stock_name] >= quantity) {
        // Update holdings
        wallet.holdings[stock_name] -= quantity;
        
        // Update wallet balance
        wallet.balance += transaction_price * quantity;
        
        status = 'Passed';
      } else {
        failureReason = 'Insufficient stocks';
      }
    }
    
    // Create transaction record
    const transactionRecord = {
      stock_name,
      stock_symbol,
      transaction_price,
      quantity,
      action,
      timestamp: new Date().toISOString(),
      status,
      user: userName
    };
    
    // Send transaction result to the user
    socket.emit('TRANSACTION_RESULT', {
      transaction: transactionRecord,
      wallet: wallet,
      failureReason
    });
    
    // If transaction was successful, broadcast to all users in the room
    if (status === 'Passed') {
      io.to(stock_name).emit('LIVE_TRANSACTION', {
        transaction: transactionRecord
      });
    }
  });
  
  // Handle client disconnection
  socket.on('disconnect', () => {
    // Remove user from all stock rooms
    Object.keys(stockRooms).forEach(stockName => {
      if (stockRooms[stockName] && stockRooms[stockName][userId]) {
        delete stockRooms[stockName][userId];
        
        // Broadcast leave notification to all users in the room
        socket.to(stockName).emit('NOTIFICATION', {
          message: `${userNames[userId]} left the room`,
          timestamp: new Date().toISOString()
        });
        
        // If room is empty, stop price fluctuation
        // if (Object.keys(stockRooms[stockName]).length === 0) {
        //   stopPriceFluctuation(stockName);
        // }
      }
    });
    
    // Clean up user data
    delete userNames[userId];
    delete userWallets[userId];
    
    console.log(`User ${userName} (${userId}) disconnected`);
  });
});

// Start price fluctuation for a stock
const priceFluctuationIntervals = {};

function startPriceFluctuation(stockName) {
  if (priceFluctuationIntervals[stockName]) {
    return; // Already running
  }
  
  // Initialize price history if empty
  if (!stockPrices[stockName].history.length) {
    const now = new Date();
    // Generate some initial price history
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(now.getTime() - (10 - i) * 5000).toISOString();
      stockPrices[stockName].history.push({
        price: stockPrices[stockName].basePrice - 100 + Math.floor(Math.random() * 200),
        timestamp
      });
    }
  }
  
  priceFluctuationIntervals[stockName] = setInterval(() => {
    // Generate random price change between -500 and 500
    const priceChange = Math.floor(Math.random() * 1001) - 500;
    const previousPrice = stockPrices[stockName].currentPrice;
    const newPrice = Math.max(1, previousPrice + priceChange); // Ensure price is at least 1
    
    // Update stock price
    stockPrices[stockName].currentPrice = newPrice;
    
    // Add to price history
    stockPrices[stockName].history.push({
      price: newPrice,
      timestamp: new Date().toISOString()
    });
    
    // Keep only the last 100 price points
    if (stockPrices[stockName].history.length > 100) {
      stockPrices[stockName].history.shift();
    }
    
    // Broadcast price update to all users in the room
    io.to(stockName).emit('STOCK_PRICE_UPDATE', {
      stockName,
      previousPrice,
      currentPrice: newPrice,
      change: priceChange,
      percentChange: ((newPrice - previousPrice) / previousPrice) * 100,
      timestamp: new Date().toISOString()
    });
  }, 5000); // Update every 5 seconds
  
  console.log(`Started price fluctuation for ${stockName}`);
}

// Stop price fluctuation for a stock
function stopPriceFluctuation(stockName) {
  if (priceFluctuationIntervals[stockName]) {
    clearInterval(priceFluctuationIntervals[stockName]);
    delete priceFluctuationIntervals[stockName];
    console.log(`Stopped price fluctuation for ${stockName}`);
  }
}

// Modify the transaction API endpoint

app.post('/api/transaction', (req, res) => {
  const { userId, stock_name, stock_symbol, transaction_price, quantity, action } = req.body;
  const userName = userNames[userId];
  const wallet = userWallets[userId];
  
  let status = 'Failed';
  let failureReason = '';
  
  // Process transaction based on action (buy/sell)
  if (action === 'buy') {
    const totalCost = transaction_price * quantity;
    
    // Check if user has enough balance
    if (wallet.balance >= totalCost) {
      // Update wallet balance
      wallet.balance -= totalCost;
      
      // Update holdings
      if (!wallet.holdings[stock_name]) {
        wallet.holdings[stock_name] = 0;
      }
      wallet.holdings[stock_name] += quantity;
      
      status = 'Passed';
    } else {
      failureReason = 'Insufficient balance';
    }
  } else if (action === 'sell') {
    // Check if user has enough holdings
    if (wallet.holdings[stock_name] && wallet.holdings[stock_name] >= quantity) {
      // Update holdings
      wallet.holdings[stock_name] -= quantity;
      
      // Update wallet balance
      const totalValue = transaction_price * quantity;
      wallet.balance += totalValue;
      
      status = 'Passed';
    } else {
      failureReason = 'Insufficient holdings';
    }
  }
  
  // Create transaction record
  const transactionRecord = {
    stock_name,
    stock_symbol,
    transaction_price,
    quantity,
    action,
    timestamp: new Date().toISOString(),
    status,
    user: userName
  };
  
  // Send transaction result to the client
  res.json({
    transaction: transactionRecord,
    wallet: wallet,
    failureReason
  });
  
  // Only broadcast successful transactions to other users
  if (status === 'Passed') {
    io.to(stock_name).emit('LIVE_TRANSACTION', {
      transaction: transactionRecord
    });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Socket.IO server is running on port ${PORT}`);
});