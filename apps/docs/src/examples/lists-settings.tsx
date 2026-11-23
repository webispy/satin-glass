import { useState } from 'react';
import { List, ListItem, ListSection, NavigationPage, NavigationStack, Switch, useNavigation } from '@satin-glass/react';
import { Bell, User } from 'lucide-react';

function Settings() {
  const nav = useNavigation();
  const [notify, setNotify] = useState(true);
  return (
    <NavigationPage title="Settings" largeTitle>
      <ListSection header="Account" footer="Notifications can be set separately on each device.">
        <List>
          {/* chevron + onClick: a row that opens the next page */}
          <ListItem leading={<User />} tileColor="var(--sg-iris-500)" title="Profile" subtitle="hello@example.com"
            chevron onClick={() => nav.push(<Profile />)} />
          <ListItem leading={<Bell />} tileColor="var(--sg-coral-500)" title="Notifications"
            trailing={<Switch checked={notify} onChange={setNotify} aria-label="Notifications" />} />
        </List>
      </ListSection>
    </NavigationPage>
  );
}

function Profile() {
  return (
    <NavigationPage title="Profile">
      <List><ListItem title="Email" trailing="hello@example.com" /></List>
    </NavigationPage>
  );
}

export default function Example() {
  /* the back button takes the previous page's title; labels.back is for screen readers */
  return <NavigationStack labels={{ back: 'Back' }} style={{ height: 360 }}><Settings /></NavigationStack>;
}
