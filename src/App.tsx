import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import Header from './components/Header/Header';
import Dashboard from './pages/Dashboard/Dashboard';
import MyPortfolio from './pages/MyPortfolio/MyPortfolio';
import Summarizer from './pages/Summarizer/StockSummarizer';
import StockPage from './pages/StockPage/StockPage';
import UserNameModal from './components/UserNameModal/UserNameModal';
import { initializeWebSocket } from './services/websocketService';

const App: React.FC = () => {
  const [showNameModal, setShowNameModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check if username is in localStorage
    const storedName = localStorage.getItem('userName');
    
    if (!storedName) {
      setShowNameModal(true);
    } else {
      connectToServer();
    }
  }, []);

  const handleNameSubmit = (name: string) => {
    // Store name in localStorage
    localStorage.setItem('userName', name);
    setShowNameModal(false);
    connectToServer();
  };

  const connectToServer = async () => {
    await initializeWebSocket();
    setIsInitialized(true);
  };

  return (
    <Provider store={store}>
      <Router>
        <Header />
        {showNameModal && <UserNameModal onSubmit={handleNameSubmit} />}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/portfolio" element={<MyPortfolio />} />
          <Route path="/summarizer" element={<Summarizer />} />
          <Route path='/stock/:name' element={<StockPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Provider>
  );
};

export default App;