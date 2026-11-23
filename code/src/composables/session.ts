import { useAuth } from '../stores/auth'
import { useLibrary } from '../stores/library'
import { useUi } from '../stores/ui'

/** Sign in, pull playlists, and fill in details for whatever list is open. */
export async function signInAndSync() {
  const auth = useAuth()
  const library = useLibrary()
  const ui = useUi()
  try {
    await auth.signIn()
    await library.refreshPlaylists()
    ui.toast(`Welcome${auth.channel ? `, ${auth.channel.title}` : ''}!`, 'success')
    if (library.active) await library.select(library.active.id)
    else if (library.sources[0]) await library.select(library.sources[0].id)
  } catch (e) {
    ui.error(e)
  }
}
