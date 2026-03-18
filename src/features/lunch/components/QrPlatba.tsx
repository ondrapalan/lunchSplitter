'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { Button } from '~/features/ui/components/Button'
import { formatCurrency } from '../utils/formatters'

const QrWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`

const QrCanvas = styled.canvas`
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`

const QrBackground = styled.div`
  background: #ffffff;
  padding: 4px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  line-height: 0;
`

const Amount = styled.span`
  color: ${({ theme }) => theme.colors.warning};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
`

interface QrPlatbaProps {
  spdString: string
  amount: number
  showCopyButton?: boolean
}

export function QrPlatba({ spdString, amount, showCopyButton = false }: QrPlatbaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    QRCode.toCanvas(canvas, spdString, {
      width: 100,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  }, [spdString])

  const handleCopy = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => {
          if (b) resolve(b)
          else reject(new Error('Failed to create image'))
        }, 'image/png')
      })
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      toast.success('QR code copied')
    } catch {
      toast.error('Could not copy QR code')
    }
  }

  return (
    <QrWrapper>
      <QrBackground>
        <QrCanvas ref={canvasRef} />
      </QrBackground>
      <Amount>{formatCurrency(amount)} CZK</Amount>
      {showCopyButton && (
        <Button variant="secondary" size="sm" onClick={handleCopy}>
          Copy QR
        </Button>
      )}
    </QrWrapper>
  )
}
