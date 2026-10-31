import { getSharedState } from '../../utils/sharedState'
export default defineEventHandler(async (event) => getSharedState(event))
