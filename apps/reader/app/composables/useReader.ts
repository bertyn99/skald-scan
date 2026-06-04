interface ReaderState {
  mangaId: string
  chapterId: string
  totalPages: number
  currentPage: number
  chapterNumber: number
  chapterTitle: string
  prevChapterId: string | null
  nextChapterId: string | null
}

export function useReader() {
  const currentPage = ref(1)
  const totalPages = ref(0)

  function updateCurrentPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  function onImageVisible(pageNumber: number) {
    currentPage.value = pageNumber
  }

  return {
    currentPage: readonly(currentPage),
    totalPages: readonly(totalPages),
    updateCurrentPage,
    onImageVisible,
    setTotalPages: (n: number) => { totalPages.value = n },
  }
}
