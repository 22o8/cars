import { requireAgent } from '../../../utils/security'
import { dispatchWhatsApp } from '../../../utils/whatsapp'
export default defineEventHandler(async event => dispatchWhatsApp(event,requireAgent(event)))
