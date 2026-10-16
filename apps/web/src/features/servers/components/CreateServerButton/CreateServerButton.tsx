import { Plus } from 'lucide-react';

import { McButton } from '@/shared/components/ui/mc-button';

interface CreateServerButtonProps {
  onClick: () => void;
}

function CreateServerButton({ onClick }: CreateServerButtonProps) {
  return (
    <McButton
      type="button"
      variant="primary"
      icon="leading"
      iconDefinition={<Plus aria-hidden="true" />}
      onClick={onClick}
    >
      Add Server
    </McButton>
  );
}

export { CreateServerButton, type CreateServerButtonProps };
