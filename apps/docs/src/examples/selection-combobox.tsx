import { useState } from 'react';
import { Combobox } from '@satin-glass/react';

const cities = [
  { label: 'North', options: [{ value: 'seoul', label: 'Seoul' }, { value: 'incheon', label: 'Incheon' }, { value: 'suwon', label: 'Suwon' }] },
  { label: 'South', options: [{ value: 'busan', label: 'Busan' }, { value: 'daegu', label: 'Daegu' }, { value: 'jeju', label: 'Jeju' }] },
];

export default function Example() {
  const [city, setCity] = useState<string | null>('busan');
  const [visits, setVisits] = useState<string[]>(['seoul']);
  return (
    <>
      <Combobox label="City" placeholder="City name" options={cities} value={city} onChange={setCity} name="city"
        labels={{ empty: 'No matching city' }} />
      {/* multiple: chosen values become chips, and the list stays open while choosing */}
      <Combobox multiple label="Cities to visit" placeholder="City name" options={cities}
        value={visits} onChange={setVisits} name="cities" />
    </>
  );
}
