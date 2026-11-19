// Placeholder welcome screen — replaced by the real feature.
import { navigate } from '@/app/router';
import { Button, Screen } from '@/design/core';
import { enterAs } from '@/state/actions';

export function WelcomeScreen() {
  const go = (persona: 'guest' | 'prospect' | 'tenant') => {
    enterAs(persona);
    navigate('/', { replace: true });
  };
  return (
    <Screen title="مناطق ون" large subtitle="خمسون خدمة. رحلة واحدة.">
      <div style={{ display: 'grid', gap: 12 }}>
        <Button block onClick={() => go('tenant')}>
          مستأجر قائم
        </Button>
        <Button block variant="secondary" onClick={() => go('prospect')}>
          مستثمر جديد
        </Button>
        <Button block variant="quiet" onClick={() => go('guest')}>
          تصفّح دون دخول
        </Button>
      </div>
    </Screen>
  );
}
