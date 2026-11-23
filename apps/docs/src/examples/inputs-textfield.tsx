import { useState } from 'react';
import { Stack, TextField } from '@satin-glass/react';

export default function Example() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  /* validate once the user leaves the field, not on every keystroke */
  const invalid = touched && email !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <Stack gap={4} style={{ maxWidth: 360 }}>
      <TextField label="Email" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)}
        clearable onClear={() => setEmail('')}
        helperText="We send the receipt here"
        error={invalid ? 'Enter a valid email address' : undefined} />
      <TextField label="Notes" multiline placeholder="Directions, parking…" />
    </Stack>
  );
}
