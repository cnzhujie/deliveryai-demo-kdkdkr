import i18next from 'i18next'
import { uid } from '@/lib/utils'
import type { AppAction, AppState, LogEntry, LogEvent } from '@/types'
import { products } from '@/data/menu'

export const initialState: AppState = {
  view: 'home',
  table: null,
  diners: ['姚乾', '林溪', '陈默'],
  cart: [],
  orderItems: [],
  orderStage: 'submitted',
  soldOut: ['p8'],
  services: [],
  paid: false,
  lastMessage: i18next.t('message.welcome'),
  logs: [],
}

const stageMessages: Record<string, string> = {
  submitted: 'message.stage_submitted',
  accepted: 'message.stage_accepted',
  cooking: 'message.stage_cooking',
  served: 'message.stage_served',
}

const stageConsoleKeys: Record<string, string> = {
  submitted: 'console.stage.submitted',
  accepted: 'console.stage.accepted',
  cooking: 'console.stage.cooking',
  served: 'console.stage.served',
}

const localeForLanguage = (lang: string) => (lang === 'en' ? 'en-US' : 'zh-CN')

function nowTimestamp(): string {
  return new Date().toLocaleTimeString(localeForLanguage(i18next.language), { hour: '2-digit', minute: '2-digit' })
}

function makeLog(event: LogEvent, detail: string): LogEntry {
  return { id: uid(), timestamp: nowTimestamp(), event, detail }
}

function appendLog(logs: LogEntry[], entry: LogEntry): LogEntry[] {
  return [...logs, entry].slice(-50)
}

export function orderReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'BIND_TABLE':
      return {
        ...state,
        table: action.table,
        view: 'welcome',
        lastMessage: i18next.t('message.bind_table', { table: action.table }),
        logs: appendLog(state.logs, makeLog('bind_table', i18next.t('console.log_detail.bind_table', { table: action.table }))),
      }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'ADD_CART': {
      const same = state.cart.find((item) => item.productId === action.item.productId && item.spec === action.item.spec && item.orderedBy === action.item.orderedBy)
      const cart = same
        ? state.cart.map((item) => item.uid === same.uid ? { ...item, quantity: item.quantity + 1 } : item)
        : [...state.cart, action.item]
      return {
        ...state,
        cart,
        lastMessage: i18next.t('message.add_cart', { name: action.item.orderedBy, dish: action.item.name }),
        logs: appendLog(state.logs, makeLog('add_cart', i18next.t('console.log_detail.add_cart', { name: action.item.orderedBy, dish: action.item.name, spec: action.item.spec }))),
      }
    }
    case 'CHANGE_QTY': {
      const target = state.cart.find((item) => item.uid === action.uid)
      const newQty = target ? target.quantity + action.delta : 0
      const cart = state.cart
        .map((item) => item.uid === action.uid ? { ...item, quantity: item.quantity + action.delta } : item)
        .filter((item) => item.quantity > 0)
      let logs = state.logs
      if (target) {
        const detail = newQty <= 0
          ? i18next.t('console.log_detail.item_removed', { dish: target.name })
          : i18next.t('console.log_detail.change_qty', { dish: target.name, old: target.quantity, new: newQty })
        logs = appendLog(state.logs, makeLog('change_qty', detail))
      }
      return { ...state, cart, logs }
    }
    case 'SUBMIT_ORDER': {
      if (!state.cart.length) return state
      const additions = state.cart.map((item) => ({ ...item, stage: 'submitted' as const }))
      const count = state.cart.length
      return {
        ...state,
        orderItems: [...state.orderItems, ...additions],
        cart: [],
        orderStage: 'submitted',
        view: 'order',
        lastMessage: state.orderItems.length ? i18next.t('message.order_additional') : i18next.t('message.order_submitted'),
        logs: appendLog(state.logs, makeLog('submit_order', i18next.t('console.log_detail.submit_order', { count }))),
      }
    }
    case 'SET_STAGE':
      return {
        ...state,
        orderStage: action.stage,
        orderItems: state.orderItems.map((item) => ({ ...item, stage: action.stage })),
        lastMessage: i18next.t(stageMessages[action.stage]),
        logs: appendLog(state.logs, makeLog('set_stage', i18next.t('console.log_detail.set_stage', { stage: i18next.t(stageConsoleKeys[action.stage]) }))),
      }
    case 'TOGGLE_SOLD_OUT': {
      const product = products.find((p) => p.id === action.productId)
      const dishName = product ? i18next.t(product.name) : action.productId
      const wasSoldOut = state.soldOut.includes(action.productId)
      return {
        ...state,
        soldOut: wasSoldOut
          ? state.soldOut.filter((id) => id !== action.productId)
          : [...state.soldOut, action.productId],
        lastMessage: i18next.t('message.soldout_updated'),
        logs: appendLog(state.logs, makeLog('toggle_sold_out',
          wasSoldOut
            ? i18next.t('console.log_detail.soldout_off', { dish: dishName })
            : i18next.t('console.log_detail.soldout_on', { dish: dishName })
        )),
      }
    }
    case 'CALL_SERVICE': {
      const serviceName = i18next.t(`${action.service}.name`)
      return {
        ...state,
        services: [...state.services, { id: uid(), type: serviceName, createdAt: nowTimestamp(), status: 'waiting' }],
        lastMessage: i18next.t('message.service_called', { service: serviceName }),
        logs: appendLog(state.logs, makeLog('call_service', i18next.t('console.log_detail.call_service', { service: serviceName }))),
      }
    }
    case 'RESPOND_SERVICES': {
      const waitingCount = state.services.filter((s) => s.status === 'waiting').length
      return {
        ...state,
        services: state.services.map((service) => ({ ...service, status: 'responded' })),
        lastMessage: i18next.t('message.service_responded'),
        logs: appendLog(state.logs, makeLog('respond_services', i18next.t('console.log_detail.respond_services', { count: waitingCount }))),
      }
    }
    case 'REQUEST_CANCEL':
      return {
        ...state,
        orderItems: state.orderItems.map((item) => item.uid === action.uid ? { ...item, cancelState: 'requested' } : item),
        lastMessage: i18next.t('message.cancel_requested'),
      }
    case 'PAY':
      return {
        ...state,
        paid: true,
        lastMessage: i18next.t('message.paid'),
        logs: appendLog(state.logs, makeLog('pay', i18next.t('console.log_detail.pay'))),
      }
    case 'RESET':
      return { ...initialState, lastMessage: i18next.t('message.reset') }
    case 'SET_MESSAGE':
      return { ...state, lastMessage: action.message }
    case 'CLEAR_LOGS':
      return { ...state, logs: [] }
    default:
      return state
  }
}
