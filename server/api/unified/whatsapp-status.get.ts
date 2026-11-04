import { requireMobilePin } from '../../utils/security'
import { whatsappReady } from '../../utils/whatsapp'
export default defineEventHandler(event => {
 requireMobilePin(event)
 setHeader(event,'Cache-Control','no-store')
 const cfg=useRuntimeConfig(event)
 return {configured:whatsappReady(cfg),webhookConfigured:!!(cfg.whatsappAppSecret&&cfg.whatsappVerifyToken),
  templateName:cfg.whatsappTemplateName,language:cfg.whatsappTemplateLanguage,
  missing:[['WHATSAPP_ACCESS_TOKEN',cfg.whatsappAccessToken],['WHATSAPP_PHONE_NUMBER_ID',cfg.whatsappPhoneNumberId],['WHATSAPP_GRAPH_VERSION',cfg.whatsappGraphVersion],['WHATSAPP_APP_SECRET',cfg.whatsappAppSecret],['WHATSAPP_VERIFY_TOKEN',cfg.whatsappVerifyToken]].filter(([,v])=>!v).map(([k])=>k)}
})
