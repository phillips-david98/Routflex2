import { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar.jsx';

const SIDEBAR_TRANSITION_MS = 260;
const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 76;

export default function Layout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTransitioning, setSidebarTransitioning] = useState(false);
  const [contentOffset, setContentOffset] = useState(0);
  const timeoutRefs = useRef([]);
  const frameRef = useRef(null);
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  function clearTransitionTimers() {
    timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutRefs.current = [];
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }

  function handleSidebarToggle() {
    clearTransitionTimers();

    const nextCollapsed = !sidebarCollapsed;
    const nextSidebarWidth = nextCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
    const visualOffset = sidebarWidth - nextSidebarWidth;

    setContentOffset(visualOffset);
    setSidebarTransitioning(true);
    setSidebarCollapsed(nextCollapsed);

    frameRef.current = requestAnimationFrame(() => {
      setContentOffset(0);
      frameRef.current = null;
    });

    timeoutRefs.current.push(setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, SIDEBAR_TRANSITION_MS + 60));

    timeoutRefs.current.push(setTimeout(() => {
      setSidebarTransitioning(false);
    }, SIDEBAR_TRANSITION_MS + 120));
  }

  useEffect(() => () => {
    clearTransitionTimers();
  }, []);

  return (
    <div className="app-shell">
      <Sidebar collapsed={sidebarCollapsed} transitioning={sidebarTransitioning} onToggle={handleSidebarToggle} />
      <div
        className={`main-content${sidebarTransitioning ? ' is-sidebar-transitioning' : ''}`}
        style={{ marginLeft: sidebarWidth, width: `calc(100% - ${sidebarWidth}px)` }}
      >
        <div className="main-content-frame" style={{ transform: `translate3d(${contentOffset}px, 0, 0)` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
