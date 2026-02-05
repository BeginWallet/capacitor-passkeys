require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CapacitorPasskeys'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = package['repository']['url'].gsub(/^git\+/, '').gsub(/\.git$/, '')
  s.author = package['author']
  s.source = { :git => package['repository']['url'].gsub(/^git\+/, ''), :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m}'
  s.ios.deployment_target = '16.0'
  s.swift_version = '5.9'
  s.dependency 'Capacitor'
  s.frameworks = 'AuthenticationServices'
end
