import React, { useState, useEffect } from 'react';
import { Transaction, FilterState } from '../../types';
import FilterSection from './FilterSection';
import TransactionList from './TransactionList';
import { isWithinDateRange } from '../../utils/dataUtils';
import { fetchTransactions } from '../../services/api';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { useAppSelector } from '../../hooks/useAppSelector';
import { setAllTransactions } from '../../store/stockSlice';
import Spinner from '../../components/Spinner/Spinner';
import './MyPortfolio.scss';

const MyPortfolio: React.FC = () => {
  const dispatch = useAppDispatch();
  const { allTransactions } = useAppSelector(state => state.stocks);
  
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [uniqueStocks, setUniqueStocks] = useState<string[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    statusFilters: {
      success: false,
      failed: false
    },
    stockFilters: {},
    dateRange: {
      startDate: null,
      endDate: null
    }
  });

  useEffect(() => {
    const getTransactions = async () => {
      try {
        setIsLoading(true);
        setIsInitialLoading(true);
        
        // Fetch real data from API
        const data = await fetchTransactions();
        
        // Update the global state with API transactions
        dispatch(setAllTransactions(data));
        
        // Extract unique stock names for filters
        const stockNames = [...new Set(allTransactions.map((t: Transaction) => t.stock_name))];
        setUniqueStocks(stockNames);
        
        // Initialize stock filters
        const initialStockFilters: Record<string, boolean> = {};
        stockNames.forEach(name => {
          initialStockFilters[name] = false;
        });
        
        setFilters(prev => ({
          ...prev,
          stockFilters: initialStockFilters
        }));
        
        setFilteredTransactions(allTransactions);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setIsLoading(false);
        setIsInitialLoading(false);
      }
    };

    getTransactions();
  }, [dispatch]);

  // Update filters and filtered transactions when allTransactions changes
  useEffect(() => {
    if (!isInitialLoading) {
      // Extract unique stock names for filters
      const stockNames = [...new Set(allTransactions.map((t: Transaction) => t.stock_name))];
      setUniqueStocks(stockNames);
      
      // Update stock filters with any new stocks
      const updatedStockFilters = { ...filters.stockFilters };
      stockNames.forEach(name => {
        if (updatedStockFilters[name] === undefined) {
          updatedStockFilters[name] = false;
        }
      });
      
      setFilters(prev => ({
        ...prev,
        stockFilters: updatedStockFilters
      }));
      
      applyFilters();
    }
  }, [allTransactions, isInitialLoading]);

  // Apply filters when they change
  useEffect(() => {
    if (!isInitialLoading) {
      applyFilters();
    }
  }, [filters, isInitialLoading]);

  const applyFilters = () => {
    setIsLoading(true);
    
    let filtered = [...allTransactions];
    
    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        t => 
          t.stock_name.toLowerCase().includes(query) || 
          (t.stock_symbol && t.stock_symbol.toLowerCase().includes(query))
      );
    }
    
    // Apply status filters
    const { success, failed } = filters.statusFilters;
    if (success || failed) {
      filtered = filtered.filter(t => 
        (success && t.status === 'Passed') || 
        (failed && t.status === 'Failed')
      );
    }
    
    // Apply stock filters
    const selectedStocks = Object.entries(filters.stockFilters)
      .filter(([_, isSelected]) => isSelected)
      .map(([stockName]) => stockName);
    
    // Instead of filtering out non-selected stocks, we'll show all but adjust their opacity
    // This is handled in the TransactionItem component via CSS
    if (selectedStocks.length > 0) {
      // We'll add a property to each transaction indicating if it's "faded" or not
      filtered = filtered.map(t => ({
        ...t,
        isFaded: !selectedStocks.includes(t.stock_name)
      }));
    } else {
      // If no stocks are selected, none should be faded
      filtered = filtered.map(t => ({
        ...t,
        isFaded: false
      }));
    }
    
    // Apply date range filter
    const { startDate, endDate } = filters.dateRange;
    if (startDate || endDate) {
      filtered = filtered.filter(t => 
        isWithinDateRange(t.timestamp, startDate, endDate)
      );
    }
    
    setFilteredTransactions(filtered);
    setIsLoading(false);
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    const resetStockFilters: Record<string, boolean> = {};
    uniqueStocks.forEach(name => {
      resetStockFilters[name] = false;
    });
    
    setFilters({
      searchQuery: '',
      statusFilters: {
        success: false,
        failed: false
      },
      stockFilters: resetStockFilters,
      dateRange: {
        startDate: null,
        endDate: null
      }
    });
  };

  return (
    <div className="portfolio">
      {isInitialLoading ? (
        <Spinner />
      ) : (
        <div className="portfolio__layout">
          <div className="portfolio__sidebar">
            <FilterSection 
              filters={filters}
              stockNames={uniqueStocks}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
            />
          </div>
          
          <div className="portfolio__content">
            <TransactionList 
              transactions={filteredTransactions}
              isLoading={isLoading && !isInitialLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPortfolio;