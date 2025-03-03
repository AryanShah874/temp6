import React, { useState } from 'react';
import './UserNameModal.scss';

interface UserNameModalProps {
  onSubmit: (name: string) => void;
}

const UserNameModal: React.FC<UserNameModalProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    if (name.length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }

    if (name.length > 15) {
      setError('Name must be less than 15 characters');
      return;
    }

    onSubmit(name.trim());
  };

  return (
    <div className="user-name-modal-overlay">
      <div className="user-name-modal">
        <h2>Welcome to Stock Market</h2>
        <p>Please enter your name to continue</p>
        
        <form onSubmit={handleSubmit}>
          <div className="user-name-modal__input-group">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
            />
            {error && <p className="user-name-modal__error">{error}</p>}
          </div>
          
          <button type="submit" className="user-name-modal__submit">
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserNameModal;