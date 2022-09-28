export const caseConstants = {
  storagePath: 'public/storage',
  defaultResultsPerPage: 20,

  hoursPerDay: 8,

  // Format is same as Sharp : http://sharp.pixelplumbing.com/en/stable/api-resize/#resize .
  imageSizes: {
    users: {
      thumbnail: {
        width: 80,
        height: 80
      }
    },
    customers: {
      thumbnail: {
        width: 80,
        height: 80
      }
    }
  }
}
