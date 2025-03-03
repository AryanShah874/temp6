import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { ArrowUp, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  setSelectedStock, 
  clearTransactions, 
  clearLiveTransactions, 
  clearPriceHistory,
  updateUserWallet,
  addTransaction
} from '../../store/stockSlice';
import { 
  initializeWebSocket, 
  joinStockRoom, 
  leaveStockRoom, 
  sendTransaction 
} from '../../services/websocketService';
import { formatTime } from '../../utils/dataUtils';
import Spinner from '../../components/Spinner/Spinner';
import './StockPage.scss';
import { sendTransactionApi } from '../../services/transactionAPI';

const StockPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const { 
    stocks, 
    selectedStock, 
    transactions, 
    liveTransactions, 
    priceHistory,
    currentPrice,
    previousPrice,
    percentChange,
    userInfo,
    webSocketConnected,
    loading
  } = useAppSelector(state => state.stocks);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [quantity, setQuantity] = useState(100);
  const [activeTab, setActiveTab] = useState('history');
  const [isInitializing, setIsInitializing] = useState(true);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const barsContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Initialize WebSocket and join stock room
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        setIsInitializing(true);
        await initializeWebSocket();
        if (name) {
          dispatch(setSelectedStock(name));
          joinStockRoom(name);
        }
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    
    connectWebSocket();
    
    return () => {
      leaveStockRoom();
      dispatch(clearTransactions());
      dispatch(clearLiveTransactions());
      dispatch(clearPriceHistory());
    };
  }, [dispatch, name]);

  // Draw grid on canvas with dotted lines
  useEffect(() => {
    if (canvasRef.current && graphContainerRef.current) {
      const canvas = canvasRef.current;
      const container = graphContainerRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Set canvas dimensions to match container
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set dotted line style
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        
        // Draw vertical grid lines (columns)
        for (let x = 0; x <= canvas.width; x += 100) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height - 30); // Leave space for x-axis labels
          ctx.stroke();
        }
        
        // Draw horizontal grid lines (rows)
        for (let y = 0; y <= canvas.height - 30; y += 125) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        
        // Draw x-axis labels
        ctx.fillStyle = '#757575';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.setLineDash([]); // Reset line dash for text
        
        for (let x = 0; x <= canvas.width; x += 100) {
          ctx.fillText(x.toString(), x, canvas.height - 10);
        }
      }
    }
  }, [graphContainerRef.current?.clientWidth, graphContainerRef.current?.clientHeight]);
  
  // Extend grid dynamically and auto-scroll graph when new price points are added
  useEffect(() => {
    if (barsContainerRef.current && graphContainerRef.current && priceHistory.length > 0) {
      // Calculate required width based on number of bars
      const barWidth = 20; // Width of each bar
      const containerWidth = priceHistory.length * barWidth;
      
      // Set min-width to ensure the bars container can grow
      if (barsContainerRef.current) {
        barsContainerRef.current.style.minWidth = `${containerWidth}px`;
      }
      
      // Auto-scroll to the latest data
      if (graphContainerRef.current) {
        graphContainerRef.current.scrollLeft = containerWidth;
      }
      
      // Redraw the canvas with extended grid if needed
      if (canvasRef.current && graphContainerRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Update canvas size if container is now wider
          const newWidth = Math.max(graphContainerRef.current.clientWidth, containerWidth);
          
          if (canvas.width < newWidth) {
            canvas.width = newWidth;
            
            // Redraw grid with dotted lines
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Set dotted line style
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.lineWidth = 1;
            
            // Draw vertical grid lines (columns)
            for (let x = 0; x <= newWidth; x += 100) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, canvas.height - 30);
              ctx.stroke();
            }
            
            // Draw horizontal grid lines (rows)
            for (let y = 0; y <= canvas.height - 30; y += 125) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(newWidth, y);
              ctx.stroke();
            }
            
            // Draw x-axis labels
            ctx.fillStyle = '#757575';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.setLineDash([]); // Reset line dash for text
            
            for (let x = 0; x <= newWidth; x += 100) {
              ctx.fillText(x.toString(), x, canvas.height - 10);
            }
          }
        }
      }
    }
  }, [priceHistory]);
  
  // Handle stock selection change
  const handleStockChange = (stockName: string) => {
    setDropdownOpen(false);
    
    if (stockName !== name) {
      navigate(`/stock/${stockName}`);
      
      // Leave current stock room and join new one
      leaveStockRoom();
      dispatch(clearTransactions());
      dispatch(clearLiveTransactions());
      dispatch(clearPriceHistory());
      dispatch(setSelectedStock(stockName));
      joinStockRoom(stockName);
    }
  };
  
  // Handle buy/sell actions
  const handleTransaction = async (action: 'buy' | 'sell') => {
    if (!selectedStock || !userInfo) return;
    
    try {
      const transactionData = {
        stock_name: selectedStock.stock_name || '',
        stock_symbol: selectedStock.stock_symbol || '',
        transaction_price: currentPrice || selectedStock.base_price || 0,
        quantity,
        action
      };
      
      const result = await sendTransactionApi(transactionData, userInfo.userId);
      
      // Handle successful transaction
      if (result.transaction.status === 'Passed') {
        // Update user wallet in Redux
        dispatch(updateUserWallet(result.wallet));
        
        // Add transaction to history
        dispatch(addTransaction(result.transaction));
      } else {
        // Handle failed transaction (e.g., show error message)
        alert(`Transaction failed: ${result.failureReason}`);
      }
    } catch (error) {
      console.error('Error processing transaction:', error);
      alert('Failed to process transaction. Please try again.');
    }
  };
  
  // Calculate normalized height for graph bars
  const calculateBarHeight = (price: number) => {
    if (priceHistory.length === 0) return 0;
    
    const maxPrice = Math.max(...priceHistory.map(p => p.price));
    const minPrice = Math.min(...priceHistory.map(p => p.price));
    const range = maxPrice - minPrice;
    
    // Normalize to a height between 10% and 90% of the container height
    const normalizedHeight = range === 0 
      ? 200 
      : 50 + ((price - minPrice) / range) * 400;
    
    return normalizedHeight;
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };
  
  // Format percentage
  const formatPercentage = (percent: number) => {
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };
  
  // Get stock symbol for dropdown
  const getStockSymbol = (stockName: string) => {
    const stock = stocks.find(s => s.stock_name === stockName);
    if (stock && stock.stock_symbol) return stock.stock_symbol;
    
    // Use first 3 letters as symbol if not found
    return stockName.substring(0, 3).toUpperCase();
  };
  
  // Render price bars
  const renderBars = () => {
    return priceHistory.map((point, index) => {
      const height = calculateBarHeight(point.price);
      const isUp = index === 0 || point.price >= priceHistory[index - 1].price;
      
      return (
        <div
          key={`bar-${index}`}
          className={`stock-page__bar stock-page__bar--${isUp ? 'up' : 'down'}`}
          style={{ height: `${height}px` }}
          title={`${formatCurrency(point.price)} at ${formatTime(point.timestamp)}`}
        ></div>
      );
    });
  };

  // Render live notifications
  const renderNotifications = () => {
    if (liveTransactions.length === 0) {
      return <div className="stock-page__empty">No activity yet</div>;
    }
    
    // Filter out current user's transactions
    const otherUsersTransactions = liveTransactions.filter(
      transaction => transaction.user !== userInfo?.userName
    );
    
    if (otherUsersTransactions.length === 0) {
      return <div className="stock-page__empty">No activity from other users yet</div>;
    }
    
    return otherUsersTransactions.map((transaction, index) => (
      <div key={`notification-${index}`} className="stock-page__notification">
        <div>
          <span className="stock-page__notification-user">{transaction.user}</span>
          {' '}
          <span className={`stock-page__notification-action stock-page__notification-action--${transaction.action}`}>
            {transaction.action === 'buy' ? 'bought' : 'sold'}
          </span>
          {' '}
          <span className="stock-page__notification-quantity">
            {transaction.quantity} {selectedStock?.stock_name}
          </span>
        </div>
        <div className="stock-page__notification-time">
          {formatTime(transaction.timestamp)}
        </div>
      </div>
    ));
  };
  
  if (loading || isInitializing) {
    return (
      <div className="stock-page">
        <Spinner />
      </div>
    );
  }
  
  if (!selectedStock) {
    return (
      <div className="stock-page">
        <div className="stock-page__error">
          <h2>Stock not found</h2>
          <p>The stock you're looking for doesn't exist or couldn't be loaded.</p>
          <button 
            className="stock-page__back-button"
            onClick={() => navigate('/')}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="stock-page">
      <div className="stock-page__content">
        <div className="stock-page__main">
          <div className="stock-page__controls">
            <div className="stock-page__dropdown">
              <div 
                className="stock-page__dropdown-header"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="stock-page__stock-symbol">
                  {selectedStock.stock_symbol || getStockSymbol(selectedStock.stock_name || '')}
                </div>
                <span>{selectedStock.stock_name}</span>
                <div className="stock-page__dropdown-icon">
                  {dropdownOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
              
              {dropdownOpen && (
                <div className="stock-page__dropdown-content">
                  {stocks.map(stock => (
                    <div 
                      key={stock.stock_name} 
                      className="stock-page__dropdown-item"
                      onClick={() => handleStockChange(stock.stock_name || '')}
                    >
                      <div className="stock-page__stock-symbol">
                        {getStockSymbol(stock.stock_name || '')}
                      </div>
                      <span>{stock.stock_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="stock-page__price-display">
              <div className="stock-page__price-label">Price</div>
              <div className="stock-page__price">
                {formatCurrency(currentPrice || selectedStock.base_price || 0)}
              </div>
              <div className={`stock-page__price-change stock-page__price-change--${percentChange >= 0 ? 'up' : 'down'}`}>
                {percentChange >= 0 ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
                <span className="stock-page__percent">
                  {formatPercentage(percentChange || 0)}
                </span>
              </div>
            </div>
            
            <div className="stock-page__quantity">
              <span>QTY:</span>
              <input 
                type="number" 
                className="stock-page__quantity-input"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                min="1"
              />
            </div>
            
            <div className="stock-page__action-buttons">
              <button 
                className="stock-page__buy-button"
                onClick={() => handleTransaction('buy')}
              >
                BUY
              </button>
              <button 
                className="stock-page__sell-button"
                onClick={() => handleTransaction('sell')}
              >
                SELL
              </button>
            </div>
          </div>
          
          <div className="stock-page__graph-container" ref={graphContainerRef}>
            <canvas ref={canvasRef} className="stock-page__grid-canvas"></canvas>
            <div className="stock-page__bars" ref={barsContainerRef}>
              {renderBars()}
            </div>
          </div>
        </div>
        
        <div className="stock-page__sidebar">
          <div className="stock-page__tab-container">
            <div className="stock-page__tab-header">
              <h3>History</h3>
            </div>
            <div className="stock-page__history-list">
              {transactions.filter(t => t.status === 'Passed').length > 0 ? (
                transactions.filter(t => t.status === 'Passed').map((transaction, index) => (
                  <div key={`history-${index}`} className="stock-page__history-item">
                    <div className="stock-page__history-details">
                      <div className="stock-page__history-quantity">
                        {transaction.quantity} stocks
                      </div>
                      <div className="stock-page__history-time">
                        {formatTime(transaction.timestamp)}
                      </div>
                    </div>
                    <div className={`stock-page__history-action stock-page__history-action--${transaction.action}`}>
                      {transaction.action === 'buy' ? 'Buy' : 'Sell'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="stock-page__empty">No transactions yet</div>
              )}
            </div>
          </div>
          
          <div className="stock-page__notification-container">
            <div className="stock-page__notification-header">
              <h3>Live Activity</h3>
            </div>
            <div className="stock-page__notification-list">
              {renderNotifications()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockPage;