import { getAuthFromEvent } from '../../utils/auth'
import { defineEventHandler, sendWebResponse, toWebRequest } from 'h3'

export default defineEventHandler(async (event) => {
  const auth = getAuthFromEvent(event)
  const request = toWebRequest(event)
  const response = await auth.handler(request)

  return sendWebResponse(event, response)
})
