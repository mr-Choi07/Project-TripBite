import { useNavigate } from 'react-router-dom'
import QrScanOverlay from '../components/qr/QrScanOverlay'

/** Bottom-nav "scan" shortcut — lets an owner or visitor already inside the
 * app re-scan a (possibly different) store's QR code, e.g. moving on to a
 * second stop, without needing to log out or restart. Reuses the same
 * overlay as the entry screen's "Scan QR" button. */
export default function QrScanScreen() {
  const navigate = useNavigate()
  return <QrScanOverlay onClose={() => navigate(-1)} />
}
