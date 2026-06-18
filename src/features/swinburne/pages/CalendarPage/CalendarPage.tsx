import { useState } from 'react'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import './CalendarPage.css'

type CalendarView = 'day' | 'week' | 'month';

function CalendarPage() {
  const [activeView, setActiveView] = useState<CalendarView>('month');

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Display a placeholder grid for the month
  const calendarCells = Array.from({ length: 35 }, (_, i) => i + 1);

  return (
    <div className="page">
      <Navbar />
      <main className="main calendar-main">
        <header className="calendar-header">
          <h1 className="page-title">Calendar</h1>
        </header>

        <div className="calendar-container">
          <div className="calendar-toolbar">
            <div className="toolbar-left">
              <button className="btn-outline btn-icon">&lt;</button>
              <button className="btn-outline btn-icon">&gt;</button>
              <button className="btn-outline btn-today">Today</button>
              <h2 className="current-month">May 2026</h2>
            </div>
            <div className="toolbar-right">
              <div className="view-switcher">
                <button 
                  className={`btn-switcher ${activeView === 'day' ? 'active' : ''}`}
                  onClick={() => setActiveView('day')}
                >
                  Day
                </button>
                <button 
                  className={`btn-switcher ${activeView === 'week' ? 'active' : ''}`}
                  onClick={() => setActiveView('week')}
                >
                  Week
                </button>
                <button 
                  className={`btn-switcher ${activeView === 'month' ? 'active' : ''}`}
                  onClick={() => setActiveView('month')}
                >
                  Month
                </button>
              </div>
            </div>
          </div>
          
          <div className="calendar-grid">
            {daysOfWeek.map(day => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}
            {calendarCells.map((dayNum, index) => {
              const date = dayNum > 31 ? dayNum - 31 : dayNum; // Quick logic for placeholder overlap
              const isToday = index === 21; // Just a placeholder for "today" (May 22)
              const hasEvent = index === 25 || index === 10;
              
              return (
                <div key={index} className={`calendar-day ${isToday ? 'today' : ''} ${dayNum > 31 ? 'fade-day' : ''}`}>
                  <span className="day-number">{date}</span>
                  {hasEvent && (
                    <div className="calendar-event-pill fpt-blue-bg">
                      {index === 25 ? 'Assignment Due' : 'Workshop'}
                    </div>
                  )}
                  {isToday && (
                    <div className="calendar-event-pill swin-red-bg">
                      Lab Session
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default CalendarPage
