import { useState } from 'react';
import { DONATION } from '@/shared/constants/support';
import { Button } from '@/presentation/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/ui/card';
import donateQr from '../../assets/support/donate-qr.png';

export function SupportSection() {
  const [copied, setCopied] = useState(false);

  const copyCardNumber = async () => {
    try {
      await navigator.clipboard.writeText(DONATION.cardNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{DONATION.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{DONATION.description}</p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <img
            src={donateQr}
            alt={DONATION.qrAlt}
            className="mx-auto w-40 rounded-lg border bg-white p-2 sm:mx-0"
            width={160}
            height={160}
          />

          <div className="flex flex-1 flex-col gap-3">
            <Button asChild className="w-full sm:w-auto">
              <a href={DONATION.privat24Url} target="_blank" rel="noopener noreferrer">
                {DONATION.linkLabel}
              </a>
            </Button>

            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">Envelope card number</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="text-sm tracking-wide">{DONATION.cardNumber}</code>
                <Button variant="outline" size="sm" type="button" onClick={() => void copyCardNumber()}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
