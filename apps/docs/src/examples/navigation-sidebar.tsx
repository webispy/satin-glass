import { useState } from 'react';
import { Sidebar, SidebarItem, SidebarSection } from '@satin-glass/react';
import { Compass, Plane, Settings, Star } from 'lucide-react';

const places = [
  { id: 'all', label: 'All places', icon: <Compass />, count: 24 },
  { id: 'fav', label: 'Favourites', icon: <Star />, count: 7 },
  { id: 'trip', label: 'Trips', icon: <Plane />, count: 3 },
];

export default function Example() {
  const [view, setView] = useState('all');
  return (
    <Sidebar style={{ width: 240 }}>
      <SidebarSection>Library</SidebarSection>
      {places.map((p) => (
        <SidebarItem key={p.id} icon={p.icon} count={p.count} selected={view === p.id} onClick={() => setView(p.id)}>{p.label}</SidebarItem>
      ))}
      <SidebarSection>Settings</SidebarSection>
      <SidebarItem icon={<Settings />} selected={view === 'prefs'} onClick={() => setView('prefs')}>Preferences</SidebarItem>
    </Sidebar>
  );
}
