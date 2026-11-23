import { ButtonGroup, IconButton, Stack } from '@satin-glass/react';
import { ChevronLeft, Heart, MoreHorizontal, Plus, Share } from 'lucide-react';

export default function Example() {
  return (
    <Stack direction="row" gap={3} align="center" wrap>
      {/* label is required: an icon alone has no name for screen readers */}
      <IconButton variant="glass" icon={<ChevronLeft />} label="Back" />
      {/* the buttons in a group share one piece of glass */}
      <ButtonGroup>
        <IconButton icon={<Share />} label="Share" />
        <IconButton icon={<Heart />} label="Like" />
        <IconButton icon={<MoreHorizontal />} label="More" />
      </ButtonGroup>
      <IconButton variant="filled" shape="round" icon={<Plus />} label="Add" />
    </Stack>
  );
}
