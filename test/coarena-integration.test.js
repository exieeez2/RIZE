/**
 * Coarena API Integration Test
 * Tests connection, health check, and basic chat functionality
 */

const { getClient } = require('../src/coarena.js');

async function runTests() {
  console.log('🧪 Testing Coarena API Integration\n');
  console.log('='.repeat(50));

  const client = getClient();

  // Test 1: Configuration
  console.log('\n📋 Test 1: Configuration Check');
  console.log('-'.repeat(30));
  console.log(`Model: ${client.model}`);
  console.log(`Fallback Models: ${client.fallbackModels.join(', ')}`);
  console.log(`OpenAI Base URL: ${client.openaiBaseUrl}`);
  console.log(`Anthropic Base URL: ${client.anthropicBaseUrl}`);
  console.log(`API Key: ${client.apiKey ? '***SET***' : 'NOT SET'}`);
  console.log(`Timeout: ${client.timeout}ms`);
  console.log(`Max Retries: ${client.maxRetries}`);

  // Test 2: Health Check
  console.log('\n🏥 Test 2: Health Check');
  console.log('-'.repeat(30));
  try {
    const health = await client.healthCheck();
    console.log(`Status: ${health.ok ? '✅ OK' : '❌ FAILED'}`);
    console.log(`Models Available: ${health.models}`);
    console.log(`Timestamp: ${health.timestamp}`);
    if (!health.ok) {
      console.log(`Error: ${health.error}`);
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
  }

  // Test 3: List Models
  console.log('\n📦 Test 3: List Models');
  console.log('-'.repeat(30));
  try {
    const models = await client.listModels();
    console.log(`✅ Models fetched successfully`);
    console.log(`Total models: ${models.data?.length || 0}`);
    if (models.data && models.data.length > 0) {
      console.log('Available models:');
      models.data.slice(0, 10).forEach(m => console.log(`  - ${m.id} (${m.display_name})`));
      if (models.data.length > 10) {
        console.log(`  ... and ${models.data.length - 10} more`);
      }
    }
  } catch (error) {
    console.log(`❌ List models failed: ${error.message}`);
  }

  // Test 4: Simple Chat (OpenAI-compatible) with fallback
  console.log('\n💬 Test 4: Simple Chat (OpenAI-compatible) with Fallback');
  console.log('-'.repeat(30));
  try {
    const response = await client.chat('Say hello in one short sentence.', 'You are a helpful assistant.');
    console.log(`✅ Chat response received`);
    console.log(`Response: ${response.choices?.[0]?.message?.content || 'No content'}`);
    console.log(`Model used: ${response.model}`);
    console.log(`Tokens: ${response.usage?.total_tokens || 'N/A'}`);
  } catch (error) {
    console.log(`❌ Chat failed: ${error.message}`);
  }

  // Test 5: Chat Completion with multiple messages
  console.log('\n💬 Test 5: Multi-turn Chat Completion');
  console.log('-'.repeat(30));
  try {
    const messages = [
      { role: 'system', content: 'You are a music expert.' },
      { role: 'user', content: 'What genre is Bohemian Rhapsody?' },
    ];
    const response = await client.chatCompletion(messages, { temperature: 0.5, maxTokens: 100 });
    console.log(`✅ Multi-turn chat response received`);
    console.log(`Response: ${response.choices?.[0]?.message?.content || 'No content'}`);
    console.log(`Model used: ${response.model}`);
  } catch (error) {
    console.log(`❌ Multi-turn chat failed: ${error.message}`);
  }

  // Test 6: Anthropic-compatible messages
  console.log('\n🤖 Test 6: Anthropic-compatible Messages');
  console.log('-'.repeat(30));
  try {
    const messages = [
      { role: 'user', content: 'What is 2+2?' },
    ];
    const response = await client.anthropicMessage(messages, { maxTokens: 50 });
    console.log(`✅ Anthropic-compatible response received`);
    console.log(`Response: ${response.content?.[0]?.text || JSON.stringify(response.content)}`);
    console.log(`Model used: ${response.model}`);
  } catch (error) {
    console.log(`❌ Anthropic-compatible failed: ${error.message}`);
  }

  // Test 7: Error handling
  console.log('\n⚠️  Test 7: Error Handling (invalid request)');
  console.log('-'.repeat(30));
  try {
    await client.chatCompletion([]); // Empty messages should fail
    console.log(`❌ Should have thrown an error`);
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 All tests completed!');
  console.log('='.repeat(50));
}

// Run tests
runTests().catch(console.error);