import { Plus } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

interface CreateServerButtonProps {
  onClick: () => void;
}

function CreateServerButton({ onClick }: CreateServerButtonProps) {
  return (
    <Button type="button" variant="primary" onClick={onClick}>
      <Plus className="size-4" />
      Add Server
    </Button>
  );
}

export { CreateServerButton, type CreateServerButtonProps };
