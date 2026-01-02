/**
 * Basketball Court Component
 * SVG-based court visualization with player positions
 */

import { useState, useEffect } from 'react';

export default function BasketballCourt({ 
  homeTeam,
  awayTeam,
  possession = 'home', // 'home' or 'away'
  ballPosition = null, // { x, y } or null
  action = null, // Current action being displayed
  language = 'pt'
}) {
  const t = translations[language];
  
  // Court dimensions (SVG viewBox)
  const courtWidth = 940;
  const courtHeight = 500;
  
  // Team colors
  const homeColor = '#4ec9b0'; // Teal
  const awayColor = '#ff6b35'; // Orange

  // Get player positions based on formation
  const getPlayerPositions = (team, isHome) => {
    const positions = {
      PG: isHome ? { x: 250, y: 250 } : { x: 690, y: 250 },
      SG: isHome ? { x: 180, y: 150 } : { x: 760, y: 150 },
      SF: isHome ? { x: 180, y: 350 } : { x: 760, y: 350 },
      PF: isHome ? { x: 100, y: 200 } : { x: 840, y: 200 },
      C: isHome ? { x: 100, y: 300 } : { x: 840, y: 300 }
    };
    
    if (!team?.players) return [];
    
    return team.players.map(player => ({
      ...player,
      position: positions[player.position] || positions.PG,
      color: isHome ? homeColor : awayColor
    }));
  };

  const homePlayers = getPlayerPositions(homeTeam, true);
  const awayPlayers = getPlayerPositions(awayTeam, false);

  return (
    <div className="basketball-court-container">
      <svg 
        viewBox={`0 0 ${courtWidth} ${courtHeight}`}
        className="basketball-court"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Court background */}
        <rect 
          x="0" y="0" 
          width={courtWidth} height={courtHeight} 
          fill="#1a5c37"
          rx="5"
        />
        
        {/* Court border */}
        <rect 
          x="10" y="10" 
          width={courtWidth - 20} height={courtHeight - 20} 
          fill="none" 
          stroke="#fff" 
          strokeWidth="3"
        />
        
        {/* Center line */}
        <line 
          x1={courtWidth / 2} y1="10" 
          x2={courtWidth / 2} y2={courtHeight - 10} 
          stroke="#fff" 
          strokeWidth="2"
        />
        
        {/* Center circle */}
        <circle 
          cx={courtWidth / 2} cy={courtHeight / 2} 
          r="60" 
          fill="none" 
          stroke="#fff" 
          strokeWidth="2"
        />
        <circle 
          cx={courtWidth / 2} cy={courtHeight / 2} 
          r="5" 
          fill="#fff"
        />
        
        {/* Left paint/key */}
        <rect 
          x="10" y="130" 
          width="190" height="240" 
          fill="rgba(255,255,255,0.1)" 
          stroke="#fff" 
          strokeWidth="2"
        />
        
        {/* Left free throw circle */}
        <circle 
          cx="200" cy="250" 
          r="60" 
          fill="none" 
          stroke="#fff" 
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        <path 
          d="M 200 190 A 60 60 0 0 1 200 310" 
          fill="none" 
          stroke="#fff" 
          strokeWidth="2"
        />
        
        {/* Left basket */}
        <circle 
          cx="60" cy="250" 
          r="18" 
          fill="none" 
          stroke="#ff4444" 
          strokeWidth="3"
        />
        <rect 
          x="10" y="220" 
          width="10" height="60" 
          fill="#ff4444"
        />
        
        {/* Left three-point line */}
        <path 
          d="M 10 70 L 140 70 A 230 230 0 0 1 140 430 L 10 430" 
          fill="none" 
          stroke="#fff" 
          strokeWidth="2"
        />
        
        {/* Right paint/key */}
        <rect 
          x={courtWidth - 200} y="130" 
          width="190" height="240" 
          fill="rgba(255,255,255,0.1)" 
          stroke="#fff" 
          strokeWidth="2"
        />
        
        {/* Right free throw circle */}
        <circle 
          cx={courtWidth - 200} cy="250" 
          r="60" 
          fill="none" 
          stroke="#fff" 
          strokeWidth="2"
          strokeDasharray="5,5"
        />
        <path 
          d={`M ${courtWidth - 200} 190 A 60 60 0 0 0 ${courtWidth - 200} 310`}
          fill="none" 
          stroke="#fff" 
          strokeWidth="2"
        />
        
        {/* Right basket */}
        <circle 
          cx={courtWidth - 60} cy="250" 
          r="18" 
          fill="none" 
          stroke="#ff4444" 
          strokeWidth="3"
        />
        <rect 
          x={courtWidth - 20} y="220" 
          width="10" height="60" 
          fill="#ff4444"
        />
        
        {/* Right three-point line */}
        <path 
          d={`M ${courtWidth - 10} 70 L ${courtWidth - 140} 70 A 230 230 0 0 0 ${courtWidth - 140} 430 L ${courtWidth - 10} 430`}
          fill="none" 
          stroke="#fff" 
          strokeWidth="2"
        />
        
        {/* Home team players */}
        {homePlayers.map((player, index) => (
          <g key={`home-${index}`} className="player-marker">
            {/* Player circle */}
            <circle
              cx={player.position.x}
              cy={player.position.y}
              r="22"
              fill={player.color}
              stroke="#fff"
              strokeWidth="2"
              className={possession === 'home' ? 'pulse' : ''}
            />
            {/* Position text */}
            <text
              x={player.position.x}
              y={player.position.y + 5}
              textAnchor="middle"
              fill="#1a1a2e"
              fontSize="12"
              fontWeight="bold"
            >
              {player.position}
            </text>
            {/* Player name (on hover - simplified to always show) */}
            <text
              x={player.position.x}
              y={player.position.y + 38}
              textAnchor="middle"
              fill="#fff"
              fontSize="10"
              className="player-name"
            >
              {player.name?.split(' ')[0]}
            </text>
          </g>
        ))}
        
        {/* Away team players */}
        {awayPlayers.map((player, index) => (
          <g key={`away-${index}`} className="player-marker">
            <circle
              cx={player.position.x}
              cy={player.position.y}
              r="22"
              fill={player.color}
              stroke="#fff"
              strokeWidth="2"
              className={possession === 'away' ? 'pulse' : ''}
            />
            <text
              x={player.position.x}
              y={player.position.y + 5}
              textAnchor="middle"
              fill="#1a1a2e"
              fontSize="12"
              fontWeight="bold"
            >
              {player.position}
            </text>
            <text
              x={player.position.x}
              y={player.position.y + 38}
              textAnchor="middle"
              fill="#fff"
              fontSize="10"
              className="player-name"
            >
              {player.name?.split(' ')[0]}
            </text>
          </g>
        ))}
        
        {/* Ball indicator */}
        {ballPosition && (
          <g className="ball">
            <circle
              cx={ballPosition.x}
              cy={ballPosition.y}
              r="12"
              fill="#ff8c00"
              stroke="#000"
              strokeWidth="2"
            />
            <text
              x={ballPosition.x}
              y={ballPosition.y + 4}
              textAnchor="middle"
              fill="#000"
              fontSize="10"
            >
              🏀
            </text>
          </g>
        )}
        
        {/* Team labels */}
        <text x="100" y="35" fill="#fff" fontSize="16" fontWeight="bold">
          {homeTeam?.name || t.home}
        </text>
        <text x={courtWidth - 100} y="35" fill="#fff" fontSize="16" fontWeight="bold" textAnchor="end">
          {awayTeam?.name || t.away}
        </text>
        
        {/* Legend */}
        <g transform="translate(380, 470)">
          <circle cx="0" cy="0" r="8" fill={homeColor} />
          <text x="15" y="4" fill="#fff" fontSize="11">{t.home}</text>
          <circle cx="100" cy="0" r="8" fill={awayColor} />
          <text x="115" y="4" fill="#fff" fontSize="11">{t.away}</text>
        </g>
      </svg>
      
      {/* Action display */}
      {action && (
        <div className="court-action">
          <span className="action-text">{action}</span>
        </div>
      )}
    </div>
  );
}

const translations = {
  pt: {
    home: 'Casa',
    away: 'Visitante'
  },
  en: {
    home: 'Home',
    away: 'Away'
  }
};
