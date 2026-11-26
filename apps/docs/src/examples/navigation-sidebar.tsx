import { useState } from 'react';
import { Button, Sidebar, SidebarItem, SidebarSection } from '@satin-glass/react';
import { Compass, Plane, Plus, Settings, Star } from 'lucide-react';

const places = [
  { id: 'all', label: 'All places', icon: <Compass />, count: 24 },
  { id: 'fav', label: 'Favourites', icon: <Star />, count: 7 },
  { id: 'trip', label: 'Trips', icon: <Plane />, count: 3 },
];
const lists = [
  { id: 'lisbon', label: 'Lisbon in spring', subtitle: '14 places · shared' },
  { id: 'coffee', label: 'Coffee near the office', subtitle: '9 places' },
];

export default function Example() {
  const [view, setView] = useState('all');
  return (
    /* a floating sidebar: the app keeps it 12 px from the screen edge and gives it a height; `attached` makes it an
       opaque panel flush with the edge instead. The footer stays in place while the list scrolls */
    <Sidebar aria-label="Places" style={{ width: 240, height: 360 }} footer={<Button variant="tinted" size="sm" block startIcon={<Plus />}>New list</Button>}>
      <SidebarSection header="Library">
        {places.map((p) => (
          <SidebarItem key={p.id} icon={p.icon} count={p.count} selected={view === p.id} onClick={() => setView(p.id)}>{p.label}</SidebarItem>
        ))}
      </SidebarSection>
      <SidebarSection header="Lists">
        {lists.map((l) => (
          <SidebarItem key={l.id} subtitle={l.subtitle} selected={view === l.id} onClick={() => setView(l.id)}>{l.label}</SidebarItem>
        ))}
      </SidebarSection>
      <SidebarSection header="Settings">
        <SidebarItem icon={<Settings />} selected={view === 'prefs'} onClick={() => setView('prefs')}>Preferences</SidebarItem>
      </SidebarSection>
    </Sidebar>
  );
}
