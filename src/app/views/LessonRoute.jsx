import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import TeacherView from './TeacherView'
import StudentView from './StudentView'

/**
 * Entry point for /lesson/:lessonId.
 * Dispatches to TeacherView or StudentView based on ?teacher=true.
 */
export default function LessonRoute() {
  const { lessonId }    = useParams()
  const [searchParams]  = useSearchParams()
  const isTeacher       = searchParams.get('teacher') === 'true'
  const isLive          = searchParams.get('live') === 'true'
  const isPresent       = searchParams.get('present') === 'true'

  if (isTeacher && isPresent) return <StudentView lessonId={lessonId} teacherPresentation />
  if (isTeacher) return <TeacherView lessonId={lessonId} />
  return <StudentView lessonId={lessonId} soloMode={!isLive} />
}
