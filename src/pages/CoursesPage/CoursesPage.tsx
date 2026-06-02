import { useState } from 'react'
import Navbar from '../../components/Navbar/Navbar'
import Footer from '../../components/Footer/Footer'
import './CoursesPage.css'

type Semester = 'last' | 'present' | 'next';

const myCourses = [
  // LAST SEMESTER (3 courses)
  {
    id: 101,
    code: 'COS10009',
    title: 'Introduction to Programming',
    description: 'Foundations of programming using Python: variables, control flow, functions, lists, dictionaries...',
    tutor: 'Dr. Markus Lumpe',
    progress: 100,
    tag: 'Swin Red',
    semester: 'last',
  },
  {
    id: 102,
    code: 'TNE10006',
    title: 'Networks and Switching',
    description: 'Explore the principles of networking, routing protocols, and digital communication networks.',
    tutor: 'Prof. Alice Roberts',
    progress: 100,
    tag: 'FPT Orange',
    semester: 'last',
  },
  {
    id: 103,
    code: 'COS10011',
    title: 'Creating Web Applications',
    description: 'Learn HTML, CSS, JavaScript and foundational backend integration for modern websites.',
    tutor: 'Mark Spencer',
    progress: 100,
    tag: 'Swin Red',
    semester: 'last',
  },

  // PRESENT SEMESTER (4 courses)
  {
    id: 1,
    code: 'COS30043',
    title: 'Interface Design and Development',
    description: 'Principles of creating user-centric digital interfaces and interactive front-end web design.',
    tutor: 'Dr. Jane Smith',
    progress: 75,
    tag: 'FPT Blue',
    semester: 'present',
  },
  {
    id: 2,
    code: 'SWE20001',
    title: 'Development Project 1 - Tools and Practices',
    description: 'Agile methodologies, version control, and collaborative software engineering toolchains.',
    tutor: 'Prof. Alan Turing',
    progress: 40,
    tag: 'FPT Orange',
    semester: 'present',
  },
  {
    id: 3,
    code: 'COS20000',
    title: 'Programming 2',
    description: 'Object-oriented programming concepts using languages like C++ and Java.',
    tutor: 'Sarah Johnson',
    progress: 90,
    tag: 'FPT Green',
    semester: 'present',
  },
  {
    id: 4,
    code: 'ICT30005',
    title: 'Professional Issues in IT',
    description: 'Ethics, privacy, legal frameworks, and professional standards in the tech industry.',
    tutor: 'Michael Lee',
    progress: 15,
    tag: 'Swin Red',
    semester: 'present',
  },

  // NEXT SEMESTER (2 courses)
  {
    id: 201,
    code: 'COS30017',
    title: 'Software Development for Mobile Devices',
    description: 'Building native and cross-platform applications for iOS and Android environments.',
    tutor: 'Emily White',
    progress: 0,
    tag: 'FPT Green',
    semester: 'next',
  },
  {
    id: 202,
    code: 'COS30019',
    title: 'Introduction to Artificial Intelligence',
    description: 'Fundamentals of AI, machine learning algorithms, and intelligent systems design.',
    tutor: 'Dr. AI Researcher',
    progress: 0,
    tag: 'FPT Blue',
    semester: 'next',
  }
];

function CoursesPage() {
  const [activeSemester, setActiveSemester] = useState<Semester>('present');

  const filteredCourses = myCourses.filter(course => course.semester === activeSemester);

  return (
    <div className="page">
      <Navbar />
      <main className="main courses-main">
        <header className="courses-header">
          <h1 className="page-title">My Courses</h1>
          <p className="page-subtitle">Manage your enrolled subjects, assignments, and grades.</p>
        </header>

        <div className="semester-tabs">
          <button
            className={`tab-btn ${activeSemester === 'last' ? 'active' : ''}`}
            onClick={() => setActiveSemester('last')}
          >
            Last Semester
          </button>
          <button
            className={`tab-btn ${activeSemester === 'present' ? 'active' : ''}`}
            onClick={() => setActiveSemester('present')}
          >
            Present Semester
          </button>
          <button
            className={`tab-btn ${activeSemester === 'next' ? 'active' : ''}`}
            onClick={() => setActiveSemester('next')}
          >
            Next Semester
          </button>
        </div>

        <section className="courses-grid" key={activeSemester}>
          {filteredCourses.map(course => (
            <div key={course.id} className="course-card">
              <div className={`course-banner ${course.tag.toLowerCase().replace(' ', '-')}`}></div>
              <div className="course-content">
                <span className="course-code">{course.code}</span>
                <h2 className="course-title">{course.title}</h2>
                <p className="course-desc">{course.description}</p>
                <p className="course-tutor">{course.tutor}</p>
              </div>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default CoursesPage
