/**
 * Composable for managing a list of items with id-based add/remove/patch/move.
 * Designed for use with v-model arrays in editor components.
 *
 * Usage:
 *   const { add, remove, patch, move } = useListEditor(
 *     () => props.modelValue,
 *     v => emit('update:modelValue', v)
 *   )
 */
export function useListEditor<T extends { id: string }>(
  getValue: () => T[],
  setValue: (val: T[]) => void,
) {
  function add(item: T) {
    setValue([...getValue(), item])
  }

  function remove(id: string) {
    setValue(getValue().filter(i => i.id !== id))
  }

  function patch(id: string, updates: Partial<T>) {
    setValue(getValue().map(i => i.id === id ? { ...i, ...updates } : i))
  }

  function move(fromIndex: number, toIndex: number) {
    const arr = [...getValue()]
    arr.splice(toIndex, 0, arr.splice(fromIndex, 1)[0])
    setValue(arr)
  }

  function reorder(newOrder: T[]) {
    setValue(newOrder)
  }

  return { add, remove, patch, move, reorder }
}
