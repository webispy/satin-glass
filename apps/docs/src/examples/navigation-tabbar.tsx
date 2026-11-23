import { useState } from 'react';
import { Badge, Tab, TabBar, TabBarAction } from '@satin-glass/react';
import { Bookmark, Home, Map, Search, User } from 'lucide-react';

export default function Example() {
  const [tab, setTab] = useState('home');
  return (
    /* add draggable to let a finger slide the selection along the bar */
    <TabBar aria-label="Main" value={tab} onChange={setTab}
      action={<TabBarAction icon={<Search />} label="Search" />}>
      <Tab value="home" label="Home" icon={<Home />} />
      <Tab value="map" label="Map" icon={<Map />} />
      <Tab value="saved" label="Saved" icon={<Bookmark />} badge={<Badge>3</Badge>} />
      <Tab value="me" label="Me" icon={<User />} />
    </TabBar>
  );
}
