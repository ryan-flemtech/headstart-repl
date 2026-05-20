import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import LessonRoute from './app/views/LessonRoute'
import LandingPage from './app/views/LandingPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/lesson/:lessonId" element={<LessonRoute />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </HashRouter>
  )
}
