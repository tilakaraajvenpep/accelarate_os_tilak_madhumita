import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function cropToDataUrl(imageSrc: string, cropPixels: Area, outputSize = 512): Promise<string> {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(image, cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height, 0, 0, outputSize, outputSize)
  return canvas.toDataURL('image/png')
}

/** Square-crop dialog for an already-selected image — used so uploads that don't already match the target box's aspect ratio can be fit to it instead of looking stretched/cropped oddly. */
export function ImageCropDialog({
  imageSrc,
  open,
  onOpenChange,
  onCropped,
  title,
  description,
}: {
  imageSrc: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCropped: (dataUrl: string) => void
  title?: string
  description?: string
}) {
  const { t } = useTranslation('common')
  const resolvedTitle = title ?? t('imageCrop.title')
  const resolvedDescription = description ?? t('imageCrop.description')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    }
    onOpenChange(next)
  }

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return
    setSaving(true)
    try {
      const dataUrl = await cropToDataUrl(imageSrc, croppedAreaPixels)
      onCropped(dataUrl)
      handleOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>

        <div className="relative h-64 w-full rounded-lg bg-muted overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{t('imageCrop.zoom')}</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!croppedAreaPixels || saving}>
            {t('imageCrop.applyCrop')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
