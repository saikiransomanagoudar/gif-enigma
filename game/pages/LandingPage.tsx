import React, { useState, useEffect } from 'react';
import { NavigationProps } from '../App';
import { colors } from '../lib/styles';
import { ChewyText } from '../lib/fonts';

export const LandingPage: React.FC<NavigationProps> = ({ onNavigate }) => {
  const [username, setUsername] = useState<string>('');
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [version] = useState<string>('1.0.0');
  const [ifhover, setHover] = useState<string | null>(null);

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
        backgroundColor: '#E8E5DA',
        borderRadius: '8px',
        //margin:'0px',
        marginTop:'-0px'
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
        <button
          style={{
            backgroundColor: ifhover === 'btn1' ? colors.primary : '#E8E5DA',
            borderRadius: '8px',
            padding: '16px',
            border: ifhover === 'btn1' ? '1px solid ${#E8E5DA}' :`1px solid ${colors.border}`,
            fontSize: '16px',
            cursor: 'pointer',
            fontFamily: 'Comic Sans MS',
            width: 'fit-content',
            marginLeft: 'auto',
            color: ifhover === 'btn1' ? 'white' : 'black'
            //marginTop:'0px'
            //color:'white'
          }}
          onClick={() => onNavigate('leaderboard')}
          onMouseEnter={() => setHover('btn1')}
          onMouseLeave={() => setHover(null)}
        >
          🏆 LEADERBOARD
        </button>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', marginTop:'-60px' }}>
          <span style={{ fontSize: '30px' }}>📺</span>
          <span style={{ fontSize: '30px' }}>❓</span>
        </div>
        
        <ChewyText size={2} color={colors.primary}>
          GIF ENIGMA
        </ChewyText>
        <p
          style={{
            fontSize: '20px',
            fontFamily: 'Comic Sans MS',
            color: 'Black',
            textAlign: 'center'
          }}
        >
          Can you guess the hidden word from a GIF?
        </p>
      </div>

      {/* Welcome Message */}
      <div
        style={{
          padding: '1px',
          backgroundColor:  '#E8E5DA',
          //borderRadius: '8px',
          //border: `0px solid ${colors.border}`,
          textAlign: 'center',
          fontFamily: 'Comic Sans MS',
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
            borderRadius: '80px',
            padding: '16px',
            width: '18%',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('game')}
        >
           PLAY
        </button>
        <button
          style={{
            backgroundColor:  colors.primary,
            borderRadius: '80px',
            padding: '16px',
            width: '18%',
            border: `0px solid ${colors.border}`,
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer'
          }}
          onClick={() => onNavigate('create')}
        >
          🛠️ CREATE
        </button>
      </div>
      <span
        style={{
          display:'flex',
          flexDirection:'row',
          alignItems:'center',
          gap: '20px',
          justifyContent: 'center',
        }}>
        <img src="https://media1.giphy.com/media/9hEtSDh6uT9NGTpNXs/giphy.gif?cid=6c09b952emxh9nn4erngl7gtioeh0g9xn8eoda0rtygihyfh&ep=v1_internal_gif_by_id&rid=giphy.gif&ct=g"
        style={{
          width:'17%',
          padding:'10px'
        }}
        >    
        </img>
        <img src="https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXM3MWRpN2tyNHhjN2RqMGJlejF5ajl6bWFsaG02cTllZTU0dXVwcCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/qt73FYHjuXqAj241m8/giphy.gif"
        style={{
          width:'17%',
          padding:'10px'
        }}
        >    
        </img>
      </span>

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
            backgroundColor: ifhover  === 'btn2' ? colors.primary : '#E8E5DA',
            borderRadius: '8px',
            padding: '16px',
            border: ifhover  === 'btn2' ? '1px solid ${#E8E5DA}' :`1px solid ${colors.border}`,
            fontSize: '16px',
            fontFamily: 'Comic Sans MS',
            cursor: 'pointer',
            color: ifhover  === 'btn2' ? 'white' : 'black',
            margin: 0,
            width:'41.1%',
            marginLeft:'auto',
            marginRight:'auto'
          }}
          onClick={() => onNavigate('howToPlay')}
          onMouseEnter={() => setHover('btn2')}
          onMouseLeave={() => setHover(null)}
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
