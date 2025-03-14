import React, { useState, useEffect } from 'react';
import { NavigationProps } from '../App';
import { colors } from '../lib/styles';
import { ChewyText } from '../lib/fonts';

export const LandingPage: React.FC<NavigationProps> = ({ onNavigate }) => {
  const [username, setUsername] = useState<string>('');
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [version] = useState<string>('1.0.0');

  useEffect(() => {
    if (!hasFetched) {
      setHasFetched(true);
      fetch('/api/currentUser')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.username) {
            setUsername(data.username);
          }
        })
        .catch((error) => {
          console.error('Error fetching user:', error);
        });
    }
  }, [hasFetched]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        padding: '20px',
        backgroundColor: colors.background,
        borderRadius: '8px'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          padding: '16px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🎬</span>
          <span style={{ fontSize: '24px' }}>❓</span>
        </div>
        <ChewyText size={2} color={colors.primary}>
          GIF ENIGMA
        </ChewyText>
        <p
          style={{
            fontSize: '16px',
            color: colors.textPrimary,
            textAlign: 'center'
          }}
        >
          Can you guess the hidden word from a GIF?
        </p>
      </div>

      {/* Welcome Message */}
      <div
        style={{
          padding: '16px',
          backgroundColor: colors.cardBackground,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}
      >
        <p style={{ fontSize: '20px' }}>
          Hi {username ? `u/${username}` : 'there'}, are you ready to unravel
          the message from GIFs?
        </p>
      </div>

      {/* Main Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '20px',
          padding: '16px',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <button
          style={{
            backgroundColor: colors.primary,
            borderRadius: '8px',
            padding: '16px',
            width: '50%',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer'
          }}
          // onClick={() => onNavigate('game')}
        >
          ▶️ PLAY
        </button>
        <button
          style={{
            backgroundColor: colors.cardBackground,
            borderRadius: '8px',
            padding: '16px',
            width: '50%',
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            fontSize: '18px',
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('create')}
        >
          🛠️ CREATE
        </button>
      </div>

      {/* Secondary Action Buttons */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '10px'
        }}
      >
        <button
          style={{
            backgroundColor: colors.cardBackground,
            borderRadius: '8px',
            padding: '16px',
            border: `1px solid ${colors.border}`,
            fontSize: '16px',
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('leaderboard')}
        >
          🏆 LEADERBOARD
        </button>
        <button
          style={{
            backgroundColor: colors.cardBackground,
            borderRadius: '8px',
            padding: '16px',
            border: `1px solid ${colors.border}`,
            fontSize: '16px',
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('howToPlay')}
        >
          ℹ️ HOW THIS GAME WORKS? 🤔
        </button>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <small style={{ fontSize: '12px', color: colors.textSecondary }}>
          Version {version}
        </small>
      </div>
    </div>
  );
};
