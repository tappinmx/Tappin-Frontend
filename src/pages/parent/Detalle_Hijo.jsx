import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../../components/Modal'
import Toast from '../../components/Toast'
import { getStudentById, updateStudentById, getTransactionHistory, postData } from '../../services/api'
import { normalizeStudent, denormalizeStudentUpdate, normalizeTransactionList } from '../../services/normalizers'
import { validateForm, isRequired } from '../../utils/validation'
import { useAuth } from '../../context/AuthContext'
import logger from '../../utils/logger'

const ChildDetails = () => {
  const navigate = useNavigate()
  const { childId } = useParams()
  const { user } = useAuth()
  // Convertir childId a número para comparar con el ID del hijo
  const numericChildId = childId ? Number(childId) : null
  const [isScrolled, setIsScrolled] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [editFormData, setEditFormData] = useState({
    nombre: '',
    tope: '',
    school: '',
    course: ''
  })
  const [editErrors, setEditErrors] = useState({})
  const [childData, setChildData] = useState(null)
  const [historial, setHistorial] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const containerRef = useRef(null)
  
  // Estados para recarga de fondos
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [rechargeError, setRechargeError] = useState('')
  const [isRecharging, setIsRecharging] = useState(false)
  
  // Estados para modales separados
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false)
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false)

  // Resetear scroll al inicio cuando se monta o cambia el childId
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.scrollTop = 0
    }
  }, [childId])

  // Detectar scroll para el efecto blur
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      setIsScrolled(container.scrollTop > 10)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Obtener datos del hijo usando el endpoint directo
  useEffect(() => {
    const loadChildData = async () => {
      setIsLoading(true)
      setIsLoadingHistory(true)

      try {
        // Convertir childId a número
        const numericChildId = parseInt(childId, 10)
        
        if (isNaN(numericChildId)) {
          throw new Error('ID de estudiante inválido')
        }

        logger.info('=== CARGANDO DATOS DEL ESTUDIANTE ===')
        logger.info('Student ID:', numericChildId)

        // Obtener datos del estudiante directamente por ID
        const studentData = await getStudentById(numericChildId)
        logger.info('Datos del estudiante recibidos:', studentData)

        // Normalizar los datos usando normalizeStudent
        const normalizedStudent = normalizeStudent(studentData)

        // Convertir al formato esperado por el componente
        const childData = {
          id: normalizedStudent.id,
          name: normalizedStudent.name,
          rfid: normalizedStudent.rfid,
          creditos: normalizedStudent.credits,
          tope: normalizedStudent.tope,
          state: normalizedStudent.state,
          parent_id: normalizedStudent.parentId,
          staff_id: normalizedStudent.staffId,
          school: normalizedStudent.school,
          course: normalizedStudent.course
        }

        setChildData(childData)
        logger.info('Datos del hijo cargados exitosamente')

        // Cargar historial si tiene rfid válido
        if (childData.rfid && childData.rfid !== 'Pendiente') {
          fetchHistorial(childData.rfid)
        } else {
          setIsLoadingHistory(false)
          logger.info('RFID pendiente, no se puede cargar historial')
        }

      } catch (error) {
        logger.error('=== ERROR AL CARGAR DATOS DEL ESTUDIANTE ===')
        logger.error('Error completo:', error)
        logger.error('Response data:', error.response?.data)
        logger.error('Response status:', error.response?.status)
        
        setChildData(null)
        setIsLoadingHistory(false)
      } finally {
        setIsLoading(false)
      }
    }

    if (childId) {
      loadChildData()
    }
  }, [childId])

  // Función para cargar historial de transacciones por RFID
  const fetchHistorial = async (rfid) => {
    try {
      setIsLoadingHistory(true)
      
      const transactions = await getTransactionHistory(rfid, 50)
      logger.info('Cargando historial de transacciones para RFID:', rfid)
      
      // Normalizar historial
      const historialArray = normalizeTransactionList(transactions)
      
      setHistorial(historialArray)
      logger.info('Historial cargado exitosamente:', historialArray.length)
    } catch (error) {
      logger.error('Error al cargar historial:', error)
      setHistorial([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleGoBack = () => {
    const backRoute = user?.role === 'staff' ? '/staff' : '/parent'
    navigate(backRoute)
  }

  const closeToast = () => {
    setToast(null)
  }

  const handleOpenEditModal = () => {
    if (!childData) return
    
    // Pre-llenar el formulario con los datos actuales
    setEditFormData({
      nombre: childData.name,
      tope: childData.tope?.toString() || '',
      school: childData.school || '',
      course: childData.course || ''
    })
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
    setEditFormData({
      nombre: '',
      tope: '',
      school: '',
      course: ''
    })
    setEditErrors({})
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Limpiar error del campo al escribir
    if (editErrors[name]) {
      setEditErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateEditFormData = () => {
    // No forzamos que los campos estén llenos: solo validamos 'tope' si fue proporcionado
    const errors = {}
    if (editFormData.tope && editFormData.tope.trim() !== '') {
      const num = Number(editFormData.tope)
      // Permitimos 0 como valor válido (padre puede dejar tope en 0)
      if (isNaN(num) || num < 0) {
        errors.tope = 'El tope debe ser un número mayor o igual a 0'
      }
    }

    setEditErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateEditFormData()) return

    try {
      setIsSubmitting(true)
      
      // Usar el ID numérico del estudiante
      const studentId = childData.id

      logger.info('=== ACTUALIZANDO DATOS DEL HIJO ===')
      logger.info('Student ID:', studentId)
      logger.info('RFID:', childData.rfid)

      // Construir objeto con los datos del formulario
      const formUpdates = {
        name: editFormData.nombre && editFormData.nombre.trim() !== '' ? editFormData.nombre : undefined,
        limit: editFormData.tope && editFormData.tope.trim() !== '' ? Number(editFormData.tope) : undefined,
        school: editFormData.school && editFormData.school.trim() !== '' ? editFormData.school : undefined,
        course: editFormData.course && editFormData.course.trim() !== '' ? editFormData.course : undefined
      }

      // Usar denormalizer para convertir al formato del backend
      const updatePayload = denormalizeStudentUpdate(formUpdates)

      logger.info('Payload para /students/{id}:', JSON.stringify(updatePayload))

      if (Object.keys(updatePayload).length === 0) {
        // Nada que actualizar
        setToast({ message: 'No hay cambios para guardar', type: 'info' })
        setIsSubmitting(false)
        return
      }

      // Actualizar usando ID en lugar de RFID
      const response = await updateStudentById(studentId, updatePayload)
      logger.info('Respuesta de actualización:', response)
      
      // Actualizar datos localmente después de la respuesta exitosa
      const updatedChild = {
        ...childData,
        // Solo sobreescribir los campos que fueron enviados
        name: formUpdates.name ?? childData.name,
        tope: formUpdates.limit ?? childData.tope,
        school: formUpdates.school ?? childData.school,
        course: formUpdates.course ?? childData.course
      }
      
      setChildData(updatedChild)
      
      logger.event('CHILD_UPDATED', { 
        id: studentId, 
        rfid: childData.rfid, 
        name: editFormData.nombre, 
        tope: editFormData.tope 
      })
      logger.info('=== ACTUALIZACIÓN COMPLETADA ===')
      
      // Mostrar toast de éxito
      setToast({
        message: 'Datos actualizados correctamente',
        type: 'success'
      })
      
      handleCloseEditModal()
    } catch (error) {
      logger.error('=== ERROR EN ACTUALIZACIÓN ===')
      logger.error('Error completo:', error)
      logger.error('Response data:', error.response?.data)
      logger.error('Response status:', error.response?.status)
      
      const errorMessage = error.response?.data?.message || error.response?.data?.detail || 'Error al actualizar los datos'
      setEditErrors({ submit: errorMessage })
      
      // Mostrar toast de error
      setToast({
        message: errorMessage,
        type: 'error'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Funciones para modal de recarga (Agregar fondos)
  const handleOpenRechargeModal = () => {
    setRechargeAmount('10')
    setRechargeError('')
    setIsRechargeModalOpen(true)
  }

  const handleCloseRechargeModal = () => {
    setRechargeAmount('')
    setRechargeError('')
    setIsRecharging(false)
    setIsRechargeModalOpen(false)
  }
  
  // Funciones para modal de recibir (en desarrollo)
  const handleOpenReceiveModal = () => {
    setIsReceiveModalOpen(true)
  }

  const handleCloseReceiveModal = () => {
    setIsReceiveModalOpen(false)
  }
  
  // Manejar cambio en el input de recarga
  const handleRechargeAmountChange = (e) => {
    const value = e.target.value
    setRechargeAmount(value)
    
    // Limpiar error al escribir
    if (rechargeError) {
      setRechargeError('')
    }
  }
  
  // Función para recargar fondos
  const handleRecharge = async (e) => {
    e.preventDefault()
    
    // Validar monto
    if (!rechargeAmount || rechargeAmount.trim() === '') {
      setRechargeError('El monto es requerido')
      return
    }
    
    const amount = parseFloat(rechargeAmount)
    
    if (isNaN(amount) || amount < 10) {
      setRechargeError('El monto mínimo es de $10 MXN')
      return
    }
    
    try {
      setIsRecharging(true)
      
      const rechargeData = {
        student_id: childData.id,
        amount: amount,
        payment_method: 'checkout'
      }
      
      logger.info('=== DATOS ENVIADOS AL BACKEND ===')
      logger.info('Recharge Data:', JSON.stringify(rechargeData, null, 2))
      console.log('🔵 ENVIANDO AL BACKEND:', rechargeData)
      
      // Llamar al endpoint de recarga
      const response = await postData('/stripe/payments/recharge', rechargeData)
      logger.info('=== RESPUESTA DEL BACKEND ===')
      logger.info('Response:', JSON.stringify(response, null, 2))
      console.log('🟢 RESPUESTA DEL BACKEND:', response)
      
      // Verificar si viene el link de pago
      if (response.checkout_url || response.payment_url || response.url) {
        const checkoutUrl = response.checkout_url || response.payment_url || response.url
        
        logger.info('=== REDIRIGIENDO A STRIPE ===')
        logger.info('Checkout URL:', checkoutUrl)
        console.log('🟡 REDIRIGIENDO A STRIPE:', checkoutUrl)
        
        // Redirigir al checkout de Stripe
        window.location.href = checkoutUrl
      } else {
        throw new Error('No se recibió la URL de pago')
      }
      
    } catch (error) {
      logger.error('Error al recargar fondos:', error)
      console.error('🔴 ERROR AL RECARGAR:', error)
      console.error('🔴 DETALLES DEL ERROR:', error.response?.data)
      setRechargeError(error.response?.data?.detail || error.response?.data?.message || 'Error al procesar la recarga')
      setIsRecharging(false)
    }
  }

  // Mostrar loading mientras cargan los datos
  if (isLoading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FDB913]"></div>
          <p className="text-light-text dark:text-dark-text text-sm">Cargando información del hijo, por favor espera...</p>
        </div>
      </div>
    )
  }

  // Si no hay datos del hijo (error de carga)
  if (!childData) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-light-text dark:text-dark-text text-lg mb-4">
            No se pudieron cargar los datos del hijo
          </p>
          <button
            onClick={handleGoBack}
            className="bg-[#FDB913] hover:bg-[#fcc000] text-black font-semibold px-6 py-2 rounded-lg"
          >
            Regresar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="page-container bg-light-bg dark:bg-dark-bg">
      {/* Header con botón de regreso */}
      <header 
        className={`${
          isScrolled 
            ? 'bg-light-card/70 dark:bg-dark-card/70 backdrop-blur-2xl shadow-md' 
            : 'bg-light-card dark:bg-dark-card shadow-sm'
        } border-b border-gray-200 dark:border-[#3a3a3c] transition-[backdrop-filter,box-shadow] duration-300 sticky top-0 z-40`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8">
          <div className="flex items-center h-16 sm:h-[68px] md:h-[72px]">
            {/* Botón de regreso */}
            <button
              onClick={handleGoBack}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#FDB913] hover:bg-[#fcc000] active:bg-[#e5a711] flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md mr-3 sm:mr-4"
              aria-label="Regresar"
            >
              <svg 
                className="w-5 h-5 sm:w-6 sm:h-6 text-black" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18" 
                />
              </svg>
            </button>

            {/* Nombre del hijo */}
            <h1 className="text-light-text dark:text-dark-text text-[17px] sm:text-lg md:text-xl font-bold transition-colors duration-200">
              {childData.name}
            </h1>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main 
        className="max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 py-5 sm:py-6 md:py-7 lg:py-8"
        style={{
          animation: 'slideInRight 0.4s ease-out both'
        }}
      >
        {/* Tarjeta de créditos */}
        <div className="bg-gradient-to-br from-[#FDB913] to-[#fcc000] rounded-2xl sm:rounded-[20px] md:rounded-[24px] p-5 sm:p-6 md:p-7 lg:p-8 mb-6 sm:mb-7 md:mb-8 shadow-[0_10px_40px_-10px_rgba(253,185,19,0.3)]">
          {/* Header - Créditos */}
          <div className="flex items-start justify-between mb-6 sm:mb-8 md:mb-10">
            <div className="flex-1">
              <p className="text-black/60 text-xs sm:text-sm mb-2 sm:mb-3 font-medium">
                Créditos
              </p>
              <h2 className="text-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold">
                ${childData.creditos}
              </h2>
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-black/10 flex items-center justify-center flex-shrink-0 ml-3">
              <svg 
                className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-black" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
          </div>

          {/* Información del hijo */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            <div>
              <p className="text-black/60 text-xs sm:text-sm mb-1 sm:mb-1.5 font-medium">
                Nombre
              </p>
              <p className="text-black text-base sm:text-lg md:text-xl font-bold">
                {childData.name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-black/60 text-xs sm:text-sm mb-1 sm:mb-1.5 font-medium">
                  RFID
                </p>
                <p className="text-black text-sm sm:text-base md:text-lg font-mono font-bold">
                  {childData.rfid}
                </p>
              </div>
              <div>
                <p className="text-black/60 text-xs sm:text-sm mb-1 sm:mb-1.5 font-medium">
                  Tope diario
                </p>
                <p className="text-black text-sm sm:text-base md:text-lg font-bold">
                  ${childData.tope}
                </p>
              </div>
            </div>
          </div>

          {/* Logo Tappin */}
          <div className="text-right">
            <p className="text-black/30 text-base sm:text-lg md:text-xl font-bold">
              Tappin
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-5 mb-6 sm:mb-7 md:mb-8">
          {/* Botón Recibir */}
          <button 
            onClick={handleOpenReceiveModal}
            className="flex flex-col items-center gap-2 sm:gap-2.5 p-3 sm:p-4 hover:scale-105 transition-transform duration-200"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] rounded-xl sm:rounded-[14px] bg-[#FDB913] hover:bg-[#fcc000] active:bg-[#e5a711] flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200">
              <svg 
                className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-black" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
                />
              </svg>
            </div>
            <p className="text-light-text dark:text-dark-text text-xs sm:text-[13px] md:text-sm font-semibold text-center">
              Recibido
            </p>
          </button>

          {/* Botón Editar */}
          <button 
            onClick={handleOpenEditModal}
            className="flex flex-col items-center gap-2 sm:gap-2.5 p-3 sm:p-4 hover:scale-105 transition-transform duration-200"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] rounded-xl sm:rounded-[14px] bg-[#FDB913] hover:bg-[#fcc000] active:bg-[#e5a711] flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200">
              <svg 
                className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-black" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                />
              </svg>
            </div>
            <p className="text-light-text dark:text-dark-text text-xs sm:text-[13px] md:text-sm font-semibold text-center">
              Editar
            </p>
          </button>

          {/* Botón Agregar fondos */}
          <button 
            onClick={handleOpenRechargeModal}
            className="flex flex-col items-center gap-2 sm:gap-2.5 p-3 sm:p-4 hover:scale-105 transition-transform duration-200"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] rounded-xl sm:rounded-[14px] bg-[#FDB913] hover:bg-[#fcc000] active:bg-[#e5a711] flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200">
              <svg 
                className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-black" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" 
                />
              </svg>
            </div>
            <p className="text-light-text dark:text-dark-text text-xs sm:text-[13px] md:text-sm font-semibold text-center">
              Agregar fondos
            </p>
          </button>
        </div>

        {/* Historial de compras */}
        <div className="bg-light-card dark:bg-dark-card rounded-xl sm:rounded-[18px] md:rounded-2xl p-4 sm:p-5 md:p-6 border border-gray-200 dark:border-[#3a3a3c]">
          <h3 className="text-light-text dark:text-dark-text text-base sm:text-lg md:text-xl font-bold mb-1">
            Historial de compras
          </h3>
          <p className="text-light-text-secondary dark:text-gray-400 text-xs sm:text-sm mb-4 sm:mb-5">
            Todas las compras
          </p>

          {/* Lista de compras */}
          <div className="space-y-3 sm:space-y-3.5">
            {historial.map((compra) => (
              <div
                key={compra.id}
                className="flex items-center justify-between p-3 sm:p-4 bg-light-bg dark:bg-dark-bg rounded-lg sm:rounded-xl transition-colors duration-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Icono */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-200 dark:bg-[#3a3a3c] flex items-center justify-center flex-shrink-0">
                    <span className="text-lg sm:text-xl">$</span>
                  </div>
                  {/* Información */}
                  <div className="flex-1 min-w-0">
                    <p className="text-light-text dark:text-dark-text text-sm sm:text-[15px] font-semibold truncate">
                      {compra.product}
                    </p>
                    <p className="text-light-text-secondary dark:text-gray-400 text-xs sm:text-[13px]">
                      {compra.timestamp}
                    </p>
                  </div>
                </div>
                {/* Precio */}
                <p className="text-light-text dark:text-dark-text text-base sm:text-lg md:text-xl font-bold ml-2">
                  $ {compra.price}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal de edición */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={handleCloseEditModal}
        title="Editar datos"
        showIcon={false}
      >
        <div className="space-y-5 sm:space-y-5 md:space-y-6">
          <form onSubmit={handleEditSubmit} className="space-y-4 sm:space-y-5">
            {/* Campo Nombre */}
            <div className="relative">
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={editFormData.nombre}
                onChange={handleEditInputChange}
                className={`peer w-full px-4 pt-6 pb-2 text-[15px] sm:text-base bg-gray-100 dark:bg-[#1a1a1a] rounded-lg text-light-text dark:text-dark-text focus:outline-none transition-all ${
                  editErrors.nombre 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'border border-gray-300 dark:border-[#3a3a3c] focus:ring-2 focus:ring-[#FDB913] focus:border-transparent'
                }`}
              />
              <label 
                htmlFor="nombre" 
                className={`absolute left-4 text-gray-400 transition-all duration-200 pointer-events-none ${
                  editFormData.nombre 
                    ? 'top-2 text-xs' 
                    : 'top-[18px] text-[15px] sm:text-base peer-focus:top-2 peer-focus:text-xs'
                }`}
              >
                Nombre
              </label>
              {editErrors.nombre && (
                <p className="text-red-500 text-[13px] sm:text-sm mt-1.5 ml-1">{editErrors.nombre}</p>
              )}
            </div>

            {/* Campo Tope */}
            <div className="relative">
              <input
                type="text"
                id="tope"
                name="tope"
                value={editFormData.tope}
                onChange={handleEditInputChange}
                className={`peer w-full px-4 pt-6 pb-2 text-[15px] sm:text-base bg-gray-100 dark:bg-[#1a1a1a] rounded-lg text-light-text dark:text-dark-text focus:outline-none transition-all ${
                  editErrors.tope 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'border border-gray-300 dark:border-[#3a3a3c] focus:ring-2 focus:ring-[#FDB913] focus:border-transparent'
                }`}
              />
              <label 
                htmlFor="tope" 
                className={`absolute left-4 text-gray-400 transition-all duration-200 pointer-events-none ${
                  editFormData.tope 
                    ? 'top-2 text-xs' 
                    : 'top-[18px] text-[15px] sm:text-base peer-focus:top-2 peer-focus:text-xs'
                }`}
              >
                Tope
              </label>
              {editErrors.tope && (
                <p className="text-red-500 text-[13px] sm:text-sm mt-1.5 ml-1">{editErrors.tope}</p>
              )}
            </div>

            {/* Campo Escuela */}
            <div className="relative">
              <input
                type="text"
                id="school"
                name="school"
                value={editFormData.school}
                onChange={handleEditInputChange}
                className={`peer w-full px-4 pt-6 pb-2 text-[15px] sm:text-base bg-gray-100 dark:bg-[#1a1a1a] rounded-lg text-light-text dark:text-dark-text focus:outline-none transition-all ${
                  editErrors.school 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'border border-gray-300 dark:border-[#3a3a3c] focus:ring-2 focus:ring-[#FDB913] focus:border-transparent'
                }`}
              />
              <label 
                htmlFor="school" 
                className={`absolute left-4 text-gray-400 transition-all duration-200 pointer-events-none ${
                  editFormData.school 
                    ? 'top-2 text-xs' 
                    : 'top-[18px] text-[15px] sm:text-base peer-focus:top-2 peer-focus:text-xs'
                }`}
              >
                Escuela
              </label>
              {editErrors.school && (
                <p className="text-red-500 text-[13px] sm:text-sm mt-1.5 ml-1">{editErrors.school}</p>
              )}
            </div>

            {/* Campo Curso */}
            <div className="relative">
              <input
                type="text"
                id="course"
                name="course"
                value={editFormData.course}
                onChange={handleEditInputChange}
                className={`peer w-full px-4 pt-6 pb-2 text-[15px] sm:text-base bg-gray-100 dark:bg-[#1a1a1a] rounded-lg text-light-text dark:text-dark-text focus:outline-none transition-all ${
                  editErrors.course 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'border border-gray-300 dark:border-[#3a3a3c] focus:ring-2 focus:ring-[#FDB913] focus:border-transparent'
                }`}
              />
              <label 
                htmlFor="course" 
                className={`absolute left-4 text-gray-400 transition-all duration-200 pointer-events-none ${
                  editFormData.course 
                    ? 'top-2 text-xs' 
                    : 'top-[18px] text-[15px] sm:text-base peer-focus:top-2 peer-focus:text-xs'
                }`}
              >
                Curso
              </label>
              {editErrors.course && (
                <p className="text-red-500 text-[13px] sm:text-sm mt-1.5 ml-1">{editErrors.course}</p>
              )}
            </div>

            {/* Botón Actualizar */}
            <button
              type="submit"
              className="w-full bg-[#FDB913] hover:bg-[#fcc000] active:bg-[#e5a711] text-black font-bold py-3.5 sm:py-3.5 md:py-4 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FDB913] focus:ring-offset-2 mt-5 sm:mt-6 text-[15px] sm:text-base md:text-[17px] shadow-sm hover:shadow-md"
            >
              Actualizar
            </button>
          </form>
        </div>
      </Modal>

      {/* Modal de recarga de fondos */}
      <Modal 
        isOpen={isRechargeModalOpen} 
        onClose={handleCloseRechargeModal}
        title="Agregar fondos"
      >
        <div className="space-y-5 sm:space-y-5 md:space-y-6">
          <p className="text-light-text-secondary dark:text-gray-400 text-[13px] sm:text-sm leading-relaxed">
            Ingrese el monto que desea agregar a la cuenta de <span className="font-semibold text-light-text dark:text-dark-text">{childData?.name}</span>
          </p>

          <form onSubmit={handleRecharge} className="space-y-4 sm:space-y-5">
            {/* Campo Monto */}
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <input
                type="number"
                id="rechargeAmount"
                name="rechargeAmount"
                value={rechargeAmount}
                onChange={handleRechargeAmountChange}
                min="10"
                step="1"
                placeholder=" "
                disabled={isRecharging}
                className={`peer w-full pl-12 pr-4 pt-6 pb-2 text-[15px] sm:text-base bg-gray-100 dark:bg-[#1a1a1a] rounded-lg text-light-text dark:text-dark-text focus:outline-none transition-all ${
                  rechargeError 
                    ? 'border-2 border-red-500 focus:ring-2 focus:ring-red-500' 
                    : 'border border-gray-300 dark:border-[#3a3a3c] focus:ring-2 focus:ring-[#FDB913] focus:border-transparent'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              <label 
                htmlFor="rechargeAmount" 
                className={`absolute left-12 text-gray-400 transition-all duration-200 pointer-events-none ${
                  rechargeAmount 
                    ? 'top-2 text-xs' 
                    : 'top-[18px] text-[15px] sm:text-base peer-focus:top-2 peer-focus:text-xs'
                }`}
              >
                Monto ($)
              </label>
              {rechargeError && (
                <p className="text-red-500 text-[13px] sm:text-sm mt-1.5 ml-1">{rechargeError}</p>
              )}
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1.5 ml-1">
                Monto mínimo a recargar: $10 MXN
              </p>
            </div>

            {/* Información adicional */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m-1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                    Será redirigido a la página segura de Stripe para completar el pago.
                  </p>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2 sm:pt-3">
              <button
                type="button"
                onClick={handleCloseRechargeModal}
                disabled={isRecharging}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gray-100 dark:bg-[#2a2b2e] hover:bg-gray-200 dark:hover:bg-[#3a3a3c] text-light-text dark:text-dark-text font-medium rounded-lg transition-colors text-[13px] sm:text-sm md:text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isRecharging}
                className="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#FDB913] hover:bg-[#fcc000] active:bg-[#e5a711] text-black font-semibold rounded-lg transition-colors text-[13px] sm:text-sm md:text-[15px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRecharging ? (
                  <>
                    <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span>Continuar al pago</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal de recibir fondos (en desarrollo) */}
      <Modal 
        isOpen={isReceiveModalOpen}
        onClose={handleCloseReceiveModal}
        showIcon={false}
        showCloseButton={false}
      >
        <RecargaHistory studentId={childData?.id} onClose={handleCloseReceiveModal} />
      </Modal>

      {/* Toast de notificaciones */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
          duration={3000}
        />
      )}
    </div>
  )
}

// Componente para mostrar historial de recargas
import { useEffect as useEffectRec, useState as useStateRec } from 'react'
import { getData } from '../../services/api'
function RecargaHistory({ studentId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recargas, setRecargas] = useState([])

  useEffect(() => {
    async function fetchRecargas() {
      setLoading(true)
      setError(null)
      try {
        const res = await getData(`/stripe/payments/history/${studentId}`)
        setRecargas(res?.payments || [])
      } catch (err) {
        setError('No se pudo cargar el historial de recargas')
      } finally {
        setLoading(false)
      }
    }
    if (studentId) fetchRecargas()
  }, [studentId])

  return (
    <div className="py-4 sm:py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-light-text dark:text-dark-text text-xl sm:text-2xl font-bold">Historial de Recargas</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#FDB913] hover:bg-[#fcc000] active:bg-[#e5a711] flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md"
          aria-label="Cerrar"
        >
          <span className="text-black text-lg sm:text-xl font-bold">×</span>
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FDB913]" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-center mb-4">{error}</p>
      ) : recargas.length === 0 ? (
        <p className="text-gray-500 text-center mb-4">No hay recargas registradas.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {recargas.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-light-card dark:bg-dark-card rounded-lg p-3 mb-2 transition-colors duration-200">
              <span className="font-semibold text-light-text dark:text-dark-text">{r.amount}</span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                {(() => {
                  if (!r.date) return 'Sin fecha';
                  const [datePart, timePart] = r.date.split(' ');
                  if (!datePart || !timePart) return r.date;
                  const [day, month, year] = datePart.split('/');
                  const [hour, minute] = timePart.split(':');
                  const d = new Date(year, month - 1, day, hour, minute);
                  return isNaN(d.getTime()) ? r.date : d.toLocaleString();
                })()}
              </span>
              <span className="ml-2 text-xs font-bold text-green-400">
                {r.status === 'completed' || r.status === 'succeeded' ? 'Acreditada' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ChildDetails
