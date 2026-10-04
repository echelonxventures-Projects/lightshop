{{- define "ls.labels" -}}
app.kubernetes.io/name: {{ .Values.name }}
app.kubernetes.io/part-of: lightshop
app.kubernetes.io/managed-by: {{ .Release.Service }}
lightshop/region: {{ .Values.global.region | quote }}
lightshop/environment: {{ .Values.global.environment | quote }}
{{- end }}

{{- define "ls.selector" -}}
app.kubernetes.io/name: {{ .Values.name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "ls.image" -}}
{{- $repo := .Values.image.repository | default (printf "%s/%s" .Values.global.imageRegistry (.Values.image.name | default .Values.name)) -}}
{{- $tag := .Values.image.tag | default .Values.global.imageTag | default .Chart.AppVersion -}}
{{ printf "%s:%s" $repo $tag }}
{{- end }}

{{- define "ls.envList" -}}
{{- $env := merge (deepCopy (.Values.env | default dict)) (.Values.global.env | default dict) -}}
- name: REGION
  value: {{ .Values.global.region | quote }}
- name: DEPLOY_ENV
  value: {{ .Values.global.environment | quote }}
{{- range $k, $v := $env }}
- name: {{ $k }}
  value: {{ $v | quote }}
{{- end }}
{{- $secretEnv := merge (deepCopy (.Values.secretEnv | default dict)) (.Values.global.secretEnv | default dict) -}}
{{- range $k, $v := $secretEnv }}
- name: {{ $k }}
  valueFrom:
    secretKeyRef: { name: {{ $v.secret }}, key: {{ $v.key }} }
{{- end }}
{{- end }}
