import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from backend root .env
dotenv.config({ path: path.join(__dirname, '../../../../.env') })

import app from './app'

const PORT = process.env.PORT || 3006

app.listen(PORT, () => {
  console.log(`Programs Service is running locally on port ${PORT}`)
})
