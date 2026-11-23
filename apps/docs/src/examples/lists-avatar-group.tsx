import { useState } from 'react';
import { Avatar, AvatarGroup, List, ListItem, Popover } from '@satin-glass/react';

const team = ['Kim Haneul', 'Lee Sora', 'Park Jimin', 'Choi Yuna', 'Jung Daon', 'Han Jiwoo'];

export default function Example() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      {/* shows 3 avatars and +N; with onMoreClick, +N is a button */}
      <AvatarGroup max={3} onMoreClick={(e) => setAnchor(e.currentTarget)}>
        {team.map((n) => <Avatar key={n} name={n} />)}
      </AvatarGroup>
      <Popover open={anchor !== null} onClose={() => setAnchor(null)} anchor={anchor} aria-label="Everyone">
        <List>{team.map((n) => <ListItem key={n} leading={<Avatar name={n} size={28} />} plainLeading title={n} />)}</List>
      </Popover>
    </>
  );
}
