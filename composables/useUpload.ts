export function useUpload() {
  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const data = await $fetch<{ url: string }>('/api/upload', {
      method: 'POST',
      body: formData,
    })
    return data.url
  }

  return { uploadFile }
}
