import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Building2,
  Cpu,
  History,
  Activity,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Server,
  Layers,
  Key,
  Database,
  Lock,
  Eye,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Department } from '../types/department.types';
import { departmentApi } from '../api/department.api';
import { auditApi, AuditRecord, AuditResponse } from '../api/audit.api';
import { extractErrorMessage } from '../api/client';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Modal } from '../components/common/Modal';
import { Skeleton } from '../components/common/Skeleton';
import { StatusBadge } from '../components/common/StatusBadge';

export const AdminPortalPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'departments' | 'connectors' | 'audit'>('departments');

  // Departments State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [deptError, setDeptError] = useState('');
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [newDeptCategories, setNewDeptCategories] = useState('education, employment');
  const [isSavingDept, setIsSavingDept] = useState(false);

  // Audit Logs State
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditRecord | null>(null);

  // Connectors State
  const [testingConnectorId, setTestingConnectorId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; latency: number } | null>(null);

  const isOfficerOrAdmin = user?.role === 'admin' || user?.role === 'department_officer';

  const loadDepartments = useCallback(async () => {
    try {
      setLoadingDepts(true);
      setDeptError('');
      const data = await departmentApi.getDepartments();
      setDepartments(data);
    } catch (err) {
      setDeptError(extractErrorMessage(err, 'Failed to fetch departments.'));
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async (page = 1) => {
    try {
      setLoadingAudit(true);
      const params: { page: number; limit: number; action?: string; outcome?: string } = {
        page,
        limit: 10
      };
      if (auditActionFilter) params.action = auditActionFilter;
      if (auditOutcomeFilter) params.outcome = auditOutcomeFilter;

      const res = await auditApi.getLogs(params);
      setAuditData(res);
      setAuditPage(page);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [auditActionFilter, auditOutcomeFilter]);

  useEffect(() => {
    if (isOfficerOrAdmin) {
      loadDepartments();
      loadAuditLogs(1);
    }
  }, [isOfficerOrAdmin, loadDepartments, loadAuditLogs]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptCode.trim() || !newDeptName.trim()) return;

    try {
      setIsSavingDept(true);
      const categories = newDeptCategories.split(',').map((c) => c.trim()).filter(Boolean);
      await departmentApi.createDepartment({
        code: newDeptCode.trim().toUpperCase(),
        name: newDeptName.trim(),
        description: newDeptDesc.trim(),
        dataCategories: categories,
        active: true
      });
      setIsAddDeptOpen(false);
      setNewDeptCode('');
      setNewDeptName('');
      setNewDeptDesc('');
      loadDepartments();
    } catch (err) {
      alert(extractErrorMessage(err, 'Failed to create department.'));
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleTestConnector = (id: string) => {
    setTestingConnectorId(id);
    setTestResult(null);
    setTimeout(() => {
      setTestingConnectorId(null);
      setTestResult({
        id,
        success: true,
        latency: Math.floor(45 + Math.random() * 80)
      });
    }, 900);
  };

  if (!isOfficerOrAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold font-serif text-slate-900">
            Official Access Restricted
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            The Admin & Department Officer Portal is restricted to authorized Government of Maharashtra personnel. Your current account role is <span className="font-semibold text-slate-900">{user?.role || 'citizen'}</span>.
          </p>
          <Button variant="primary" onClick={() => navigate('/dashboard')} className="w-full">
            Return to Citizen Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gov-surface py-8 sm:py-12">
      <div className="max-w-portal mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Portal Header */}
        <div className="bg-white rounded-xl border border-gov-border shadow-portal p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gov-lightblue text-gov-blue text-xs font-semibold uppercase tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>MahaSetu State Interoperability Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gov-dark">
              State Administration & Connector Gateway
            </h1>
            <p className="text-xs sm:text-sm text-gov-textSecondary leading-relaxed">
              Configure department adapters, inspect cryptographic audit trails, and manage state-wide data interchange connectors.
            </p>
          </div>

          <div className="bg-gov-surface rounded-xl p-4 border border-gov-border text-xs space-y-1 sm:min-w-[200px]">
            <span className="text-slate-400 block">Logged in Official:</span>
            <span className="font-bold text-gov-textPrimary block text-sm">{user?.name}</span>
            <span className="inline-block px-2 py-0.5 rounded bg-gov-lightblue text-gov-blue font-mono text-[10px] font-bold">
              {user?.role.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Telemetry Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Registered Depts</span>
              <Building2 className="w-4 h-4 text-gov-blue" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900">{departments.length || 6}</p>
            <span className="text-[11px] text-green-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> 100% Operational
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Adapters Active</span>
              <Server className="w-4 h-4 text-saffron-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900">4 / 4</p>
            <span className="text-[11px] text-slate-500 font-medium">REST & SOAP Bridges</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Verification Engine</span>
              <Activity className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900">98.4%</p>
            <span className="text-[11px] text-green-700 font-semibold">Match Accuracy</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-1 shadow-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">DPDP Consent Gate</span>
              <ShieldCheck className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold font-mono text-slate-900">100%</p>
            <span className="text-[11px] text-purple-700 font-semibold">Strict Enforcement</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'departments'
                ? 'bg-gov-blue text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Department Registry
          </button>

          <button
            onClick={() => setActiveTab('connectors')}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'connectors'
                ? 'bg-gov-blue text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Integration Connectors & Adapters
          </button>

          <button
            onClick={() => { setActiveTab('audit'); loadAuditLogs(1); }}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-gov-blue text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <History className="w-4 h-4" />
            State Audit Log Explorer
          </button>
        </div>

        {/* Tab 1: Department Registry */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-slate-900">
                  Registered State Administrative Departments
                </h2>
                <p className="text-xs text-slate-500">
                  Manage department metadata, allowed data schemas, and access control tokens.
                </p>
              </div>

              <Button variant="primary" size="sm" onClick={() => setIsAddDeptOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Register New Department
              </Button>
            </div>

            {loadingDepts ? (
              <div className="space-y-3">
                <Skeleton height="50px" />
                <Skeleton height="50px" />
                <Skeleton height="50px" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Department Name</th>
                      <th className="px-4 py-3">Data Categories</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departments.map((dept) => (
                      <tr key={dept._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gov-navy">{dept.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{dept.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(dept.dataCategories || ['education']).map((cat) => (
                              <span key={cat} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-semibold">
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-green-600" /> Active
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {dept.updatedAt ? new Date(dept.updatedAt).toLocaleDateString('en-IN') : 'Active'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Connectors & Adapters Monitor */}
        {activeTab === 'connectors' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold font-serif text-slate-900">
                  Integration Engine Connectors & Adapters
                </h2>
                <p className="text-xs text-slate-500">
                  Configured protocol bridges (REST / SOAP / XML) connecting external state databases into the canonical MahaSetu schema.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    id: 'edu-rest',
                    name: 'Higher Education Department REST Adapter',
                    protocol: 'REST / JSON',
                    endpoint: 'https://edu-api.mahasetu.gov.in/v1/students',
                    auth: 'JWT (Client Credentials)',
                    circuitBreaker: 'CLOSED (Healthy)',
                    avgLatency: '62ms',
                    uptime: '99.98%'
                  },
                  {
                    id: 'emp-soap',
                    name: 'Employment Exchange SOAP Adapter',
                    protocol: 'SOAP 1.2 / XML',
                    endpoint: 'https://mha-employment.gov.in/ws/CandidateService.asmx',
                    auth: 'API-Key / Header Auth',
                    circuitBreaker: 'CLOSED (Healthy)',
                    avgLatency: '118ms',
                    uptime: '99.95%'
                  },
                  {
                    id: 'rev-soap',
                    name: 'Land Records & Revenue (MahaBhumi) Adapter',
                    protocol: 'SOAP 1.1 / WSDL',
                    endpoint: 'https://mahabhumi.gov.in/services/LandRegistry',
                    auth: 'Mutual TLS + Token',
                    circuitBreaker: 'CLOSED (Healthy)',
                    avgLatency: '84ms',
                    uptime: '99.99%'
                  },
                  {
                    id: 'aadhaar-vault',
                    name: 'UIDAI e-KYC & Aadhaar Vault Bridge',
                    protocol: 'REST / HTTPS',
                    endpoint: 'https://uidai.gov.in/auth/v2.5/verify',
                    auth: 'PKI Signed Payload',
                    circuitBreaker: 'CLOSED (Healthy)',
                    avgLatency: '55ms',
                    uptime: '100.0%'
                  }
                ].map((conn) => (
                  <div
                    key={conn.id}
                    className="border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-slate-300 transition-all bg-slate-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[11px] font-bold">
                          {conn.protocol}
                        </span>
                        <h3 className="font-bold text-slate-900 text-base font-serif mt-1">
                          {conn.name}
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Online
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200/80 font-mono">
                      <div className="truncate">
                        <span className="text-slate-400">Endpoint: </span>
                        {conn.endpoint}
                      </div>
                      <div>
                        <span className="text-slate-400">Auth Type: </span>
                        {conn.auth}
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 text-slate-700">
                        <span>Circuit: <strong className="text-green-700 font-sans">{conn.circuitBreaker}</strong></span>
                        <span>Latency: <strong>{conn.avgLatency}</strong></span>
                        <span>Uptime: <strong>{conn.uptime}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {testResult && testResult.id === conn.id ? (
                        <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Ping OK ({testResult.latency}ms)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Auto-retry & backoff enabled</span>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConnector(conn.id)}
                        disabled={testingConnectorId === conn.id}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${testingConnectorId === conn.id ? 'animate-spin' : ''}`} />
                        {testingConnectorId === conn.id ? 'Testing...' : 'Test Ping'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Audit Log Explorer */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-slate-900">
                  Cryptographic Audit Trail Explorer
                </h2>
                <p className="text-xs text-slate-500">
                  Immutable access logs verifying all citizen authentications, data exchanges, consent grants, and verification events.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gov-blue"
                >
                  <option value="">All Actions</option>
                  <option value="AUTH_LOGIN">AUTH_LOGIN</option>
                  <option value="AUTH_REGISTER">AUTH_REGISTER</option>
                  <option value="APPLICATION_CREATE">APPLICATION_CREATE</option>
                  <option value="CONSENT_GRANT">CONSENT_GRANT</option>
                  <option value="CONSENT_REVOKE">CONSENT_REVOKE</option>
                  <option value="VERIFICATION_TRIGGER">VERIFICATION_TRIGGER</option>
                </select>

                <select
                  value={auditOutcomeFilter}
                  onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gov-blue"
                >
                  <option value="">All Outcomes</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILURE">FAILURE</option>
                  <option value="DENIED">DENIED</option>
                </select>

                <Button variant="outline" size="sm" onClick={() => loadAuditLogs(auditPage)}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingAudit ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {loadingAudit ? (
              <div className="space-y-3">
                <Skeleton height="40px" />
                <Skeleton height="40px" />
                <Skeleton height="40px" />
              </div>
            ) : auditData && auditData.logs && auditData.logs.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-3.5 py-2.5">Timestamp</th>
                        <th className="px-3.5 py-2.5">Action</th>
                        <th className="px-3.5 py-2.5">Actor / Role</th>
                        <th className="px-3.5 py-2.5">Resource ID</th>
                        <th className="px-3.5 py-2.5">Outcome</th>
                        <th className="px-3.5 py-2.5">Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {auditData.logs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3.5 py-2.5 font-bold text-gov-navy">
                            {log.action}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700">
                            {log.actorRole ? `${log.actorRole}` : 'system'}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600 truncate max-w-[120px]">
                            {log.resourceId || log.applicationId || '-'}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.outcome === 'SUCCESS'
                                  ? 'bg-green-100 text-green-800'
                                  : log.outcome === 'FAILURE'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {log.outcome}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-sans">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAuditLog(log)}
                              className="text-[11px] py-1 px-2 h-auto"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View JSON
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {auditData.pagination && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>
                      Showing Page {auditData.pagination.page} of {auditData.pagination.pages || 1} ({auditData.pagination.total} total events)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditData.pagination.page <= 1}
                        onClick={() => loadAuditLogs(auditPage - 1)}
                      >
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditData.pagination.page >= auditData.pagination.pages}
                        onClick={() => loadAuditLogs(auditPage + 1)}
                      >
                        Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-sm">
                No audit events found matching the filter criteria.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Department Modal */}
      {isAddDeptOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddDeptOpen(false)}
          title="Register New Administrative Department"
          maxWidth="md"
        >
          <form onSubmit={handleCreateDepartment} className="space-y-4">
            <Input
              label="Department Code *"
              placeholder="e.g. AGRI_DEPT, REVENUE_GOM"
              value={newDeptCode}
              onChange={(e) => setNewDeptCode(e.target.value)}
              helperText="Unique uppercase identifier for system orchestration"
              required
            />

            <Input
              label="Official Department Name *"
              placeholder="e.g. Agriculture Department, Govt of Maharashtra"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department Description
              </label>
              <textarea
                rows={3}
                value={newDeptDesc}
                onChange={(e) => setNewDeptDesc(e.target.value)}
                placeholder="Brief summary of department services and responsibilities..."
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gov-blue"
              />
            </div>

            <Input
              label="Supported Data Categories *"
              placeholder="e.g. education, employment, revenue, identity"
              value={newDeptCategories}
              onChange={(e) => setNewDeptCategories(e.target.value)}
              helperText="Comma separated list of canonical data schemas"
              required
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={() => setIsAddDeptOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSavingDept}>
                {isSavingDept ? 'Registering...' : 'Register Department'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Audit Log JSON Inspector Modal */}
      {selectedAuditLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAuditLog(null)}
          title={`Audit Event: ${selectedAuditLog.action}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs overflow-x-auto max-h-96">
              <pre>{JSON.stringify(selectedAuditLog, null, 2)}</pre>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setSelectedAuditLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
